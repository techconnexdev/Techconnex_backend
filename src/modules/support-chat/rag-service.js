/**
 * RAG service: ingest PDFs into chunks with embeddings, search relevant chunks.
 * Uses Company Manual + Provider Manual only.
 */
import { OpenAIEmbeddings } from "@langchain/openai";
import { PrismaClient } from "@prisma/client";
import { downloadFileFromR2 } from "../../utils/r2.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const prisma = new PrismaClient();

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;
const TOP_K = 10;
const SEMANTIC_POOL = 25; // Fetch more for hybrid reranking

/** Terms that suggest user wants overview/TOC; we expand the query for better retrieval */
const OVERVIEW_TERMS = /table\s*of\s*contents|toc|overview|what\s*(does|is|topics)|chapters?|sections?|topics?\s*covered|structure|contents?\s*of|manual\s*cover|what's\s*in/i;

/**
 * Extract meaningful search tokens from query (skip common words).
 */
function extractSearchTokens(query) {
  const stop = new Set(["the", "a", "an", "is", "are", "can", "you", "me", "tell", "about", "of", "to", "in", "for", "and", "or", "what", "how", "does", "do", "refer", "manual", "user"]);
  return (query || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

/**
 * Simple keyword score: how many query terms appear in the chunk (case-insensitive).
 */
function keywordScore(chunkContent, tokens) {
  if (!tokens.length) return 0;
  const lower = (chunkContent || "").toLowerCase();
  let matches = 0;
  for (const t of tokens) {
    if (lower.includes(t)) matches++;
  }
  return matches / tokens.length;
}

/**
 * Split text into overlapping chunks.
 */
function splitIntoChunks(text) {
  const chunks = [];
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return chunks;

  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);
    if (end < cleaned.length) {
      const lastSpace = cleaned.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end - (end - start > CHUNK_OVERLAP ? CHUNK_OVERLAP : 0);
    if (start >= cleaned.length) break;
  }
  return chunks.filter(Boolean);
}

/**
 * Get OpenAI embeddings instance.
 */
function getEmbeddings() {
  return new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Ingest a PDF: extract text, chunk, embed, save to DB.
 * @param {string} documentId - SupportReferenceDocument id
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {{ chunksCreated: number }}
 */
export async function indexDocument(documentId, pdfBuffer) {
  const document = await prisma.supportReferenceDocument.findUnique({
    where: { id: documentId },
  });
  if (!document) throw new Error("Reference document not found");

  const data = await pdfParse(pdfBuffer);
  const text = (data.text || "").trim();
  if (!text) throw new Error("No text extracted from PDF");

  const chunks = splitIntoChunks(text);
  if (chunks.length === 0) throw new Error("No chunks produced");

  const embeddings = getEmbeddings();
  const vectors = await embeddings.embedDocuments(chunks);

  await prisma.supportReferenceChunk.deleteMany({ where: { documentId } });

  for (let i = 0; i < chunks.length; i++) {
    await prisma.supportReferenceChunk.create({
      data: {
        documentId,
        content: chunks[i],
        embedding: vectors[i],
        page: data.numpages ? Math.min(i + 1, data.numpages) : null,
      },
    });
  }

  const indexedAt = new Date();
  await prisma.supportReferenceDocument.update({
    where: { id: documentId },
    data: { indexedAt },
  });

  return { chunksCreated: chunks.length };
}

/**
 * Cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Map user role to document slug prefix for RAG filtering.
 * company_manual, company_* -> company; provider_manual, provider_* -> provider.
 * @param {"provider"|"company"|"unknown"} audience
 * @returns {string|null} slug prefix to filter by, or null for all docs
 */
function slugPrefixForAudience(audience) {
  if (audience === "provider") return "provider";
  if (audience === "company") return "company";
  return null;
}

/**
 * Reciprocal Rank Fusion: merge two ranked lists by score = 1/(k + rank).
 * @param {Array} semantic - items sorted by semantic score (best first)
 * @param {Array} keyword - items sorted by keyword score (best first)
 * @param {number} k - RRF constant (60 is standard)
 */
function reciprocalRankFusion(semantic, keyword, k = 60) {
  const scores = new Map();
  const byId = (arr) => arr.reduce((m, it) => m.set(it.id, it), new Map());
  const semMap = byId(semantic);
  const kwMap = byId(keyword);

  semantic.forEach((it, i) => {
    scores.set(it.id, (scores.get(it.id) || 0) + 1 / (k + i + 1));
  });
  keyword.forEach((it, i) => {
    scores.set(it.id, (scores.get(it.id) || 0) + 1 / (k + i + 1));
  });

  const merged = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => semMap.get(id) || kwMap.get(id))
    .filter(Boolean);
  return merged;
}

/**
 * Search relevant chunks using hybrid retrieval (semantic + keyword) with optional query expansion.
 * @param {string} query
 * @param {number} limit
 * @param {"provider"|"company"|"unknown"} [audience] - If provider/company, only search docs with matching slug prefix
 * @returns {Promise<{ content: string, documentId: string, documentSlug: string }[]>}
 */
export async function searchRelevantChunks(query, limit = TOP_K, audience = null) {
  const embeddings = getEmbeddings();

  const slugPrefix = slugPrefixForAudience(audience);
  const where = slugPrefix
    ? { document: { slug: { startsWith: slugPrefix } } }
    : {};

  let chunks = await prisma.supportReferenceChunk.findMany({
    where,
    include: { document: true },
  });

  if (chunks.length === 0 && slugPrefix) {
    chunks = await prisma.supportReferenceChunk.findMany({
      include: { document: true },
    });
  }

  const toVector = (emb) => {
    if (Array.isArray(emb)) return emb;
    if (emb && typeof emb === "object") return Object.values(emb);
    return [];
  };

  const tokens = extractSearchTokens(query);
  const isOverviewQuery = OVERVIEW_TERMS.test(query);
  const expandedQuery = isOverviewQuery
    ? `${query} table of contents chapters sections overview structure topics covered`
    : query;

  const [queryVector, expandedVector] = await embeddings.embedDocuments([
    query,
    expandedQuery,
  ]);

  const semanticList = chunks
    .filter((c) => toVector(c.embedding).length > 0)
    .map((c) => ({
      ...c,
      vec: toVector(c.embedding),
      semanticScore: cosineSimilarity(queryVector, toVector(c.embedding)),
    }))
    .sort((a, b) => b.semanticScore - a.semanticScore)
    .slice(0, SEMANTIC_POOL);

  const expandedList = isOverviewQuery
    ? chunks
        .filter((c) => toVector(c.embedding).length > 0)
        .map((c) => ({
          ...c,
          vec: toVector(c.embedding),
          expandedScore: cosineSimilarity(expandedVector, toVector(c.embedding)),
        }))
        .sort((a, b) => b.expandedScore - a.expandedScore)
        .slice(0, SEMANTIC_POOL)
    : [];

  const keywordList = chunks
    .filter((c) => toVector(c.embedding).length > 0)
    .map((c) => ({
      ...c,
      kwScore: keywordScore(c.content, tokens),
    }))
    .filter((c) => c.kwScore > 0)
    .sort((a, b) => b.kwScore - a.kwScore)
    .slice(0, SEMANTIC_POOL);

  let merged;
  if (expandedList.length > 0) {
    merged = reciprocalRankFusion(semanticList, expandedList, 30);
  } else if (keywordList.length > 0) {
    merged = reciprocalRankFusion(semanticList, keywordList, 60);
  } else {
    merged = semanticList;
  }

  const result = merged.slice(0, limit).map((c) => ({
    content: c.content,
    documentId: c.documentId,
    documentSlug: c.document?.slug || "",
  }));

  return result;
}
