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
const TOP_K = 5;

/**
 * Split text into overlapping chunks.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoChunks(text) {
  const chunks = [];
  let start = 0;
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return chunks;

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
 * Search relevant chunks from all reference documents.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<{ content: string, documentId: string, documentSlug: string }[]>}
 */
export async function searchRelevantChunks(query, limit = TOP_K) {
  const embeddings = getEmbeddings();
  const [queryVector] = await embeddings.embedDocuments([query]);

  const chunks = await prisma.supportReferenceChunk.findMany({
    include: { document: true },
  });

function toVector(emb) {
  if (Array.isArray(emb)) return emb;
  if (emb && typeof emb === "object") return Object.values(emb);
  return [];
}

  const withScore = chunks.map((c) => {
    const vec = toVector(c.embedding);
    return { ...c, vec, score: cosineSimilarity(queryVector, vec) };
  });

  const sorted = withScore
    .filter((c) => c.vec.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return sorted.map((c) => ({
    content: c.content,
    documentId: c.documentId,
    documentSlug: c.document?.slug || "",
  }));
}
