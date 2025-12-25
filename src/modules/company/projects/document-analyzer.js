// src/modules/company/projects/document-analyzer.js
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { parseDocument, parseDocumentFromBuffer } from "./document-parser.js";
import { downloadFileFromR2 } from "../../../utils/r2.js";

/**
 * Analyze project document from R2 and extract structured data
 * Returns data with flags indicating which fields are from the document vs AI suggestions
 */
export async function analyzeProjectDocumentFromR2(r2Key, mimeType, fileName) {
  try {
    // Download file from R2
    console.log("Downloading project document from R2:", r2Key);
    const dataBuffer = await downloadFileFromR2(r2Key);
    
    // Parse the document from buffer to extract text
    const documentText = await parseDocumentFromBuffer(dataBuffer, mimeType, fileName);
    
    if (!documentText || documentText.trim().length === 0) {
      throw new Error("Document is empty or could not be parsed");
    }

    // Use LangChain to extract structured data
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are an expert assistant that extracts structured project information from documents (proposals, project briefs, requirements documents, etc.).

Extract the following information from the provided document text. For each field:
- If the information is clearly stated in the document, extract it and set "source" to "document"
- If the information is not in the document but can be inferred, suggest a value and set "source" to "ai_suggestion"
- If the information cannot be determined, set the value to null and "source" to "missing"

Return ONLY valid JSON in this exact format:
{{
  "title": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "description": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "category": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "budgetMin": {{"value": number | null, "source": "document" | "ai_suggestion" | "missing"}},
  "budgetMax": {{"value": number | null, "source": "document" | "ai_suggestion" | "missing"}},
  "timelineAmount": {{"value": number | null, "source": "document" | "ai_suggestion" | "missing"}},
  "timelineUnit": {{"value": "day" | "week" | "month" | null, "source": "document" | "ai_suggestion" | "missing"}},
  "skills": {{"value": ["skill1", "skill2", ...], "source": "document" | "ai_suggestion" | "missing"}},
  "priority": {{"value": "low" | "medium" | "high" | null, "source": "document" | "ai_suggestion" | "missing"}},
  "requirements": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "deliverables": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "ndaSigned": {{"value": boolean | null, "source": "document" | "ai_suggestion" | "missing"}}
}}

Guidelines:
- For "category", use standard categories: WEB_DEVELOPMENT, MOBILE_APP_DEVELOPMENT, CLOUD_SERVICES, IOT_SOLUTIONS, DATA_ANALYTICS, CYBERSECURITY, UI_UX_DESIGN, DEVOPS, AI_ML_SOLUTIONS, SYSTEM_INTEGRATION, or a custom category name
- For "timelineUnit", infer from context (e.g., "2 weeks" -> {{"value": 2, "source": "document"}}, "timelineUnit": {{"value": "week", "source": "document"}})
- For "skills", extract all mentioned technologies, frameworks, tools, and programming languages
- For "requirements" and "deliverables", preserve the original text or markdown if present
- Be conservative: only mark as "document" if the information is explicitly stated
- For AI suggestions, provide reasonable defaults based on the document content and industry standards

Document Text:
{documentText}

Return ONLY valid JSON — no explanations, text, or code blocks.
`);

    const chain = RunnableSequence.from([prompt, model]);
    const result = await chain.invoke({ documentText });

    let content = result.content?.trim() || "";

    // Clean up any markdown or code fences
    if (content.startsWith("```json") || content.startsWith("```")) {
      content = content.replace(/```json|```/g, "").trim();
    }
    if (content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }

    try {
      const extracted = JSON.parse(content);
      
      // Validate and normalize the structure
      return {
        title: extracted.title || { value: null, source: "missing" },
        description: extracted.description || { value: null, source: "missing" },
        category: extracted.category || { value: null, source: "missing" },
        budgetMin: extracted.budgetMin || { value: null, source: "missing" },
        budgetMax: extracted.budgetMax || { value: null, source: "missing" },
        timelineAmount: extracted.timelineAmount || { value: null, source: "missing" },
        timelineUnit: extracted.timelineUnit || { value: null, source: "missing" },
        skills: extracted.skills || { value: [], source: "missing" },
        priority: extracted.priority || { value: "medium", source: "ai_suggestion" },
        requirements: extracted.requirements || { value: null, source: "missing" },
        deliverables: extracted.deliverables || { value: null, source: "missing" },
        ndaSigned: extracted.ndaSigned || { value: false, source: "ai_suggestion" },
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("AI returned invalid JSON format");
    }
  } catch (error) {
    console.error("Error analyzing project document from R2:", error);
    throw error;
  }
}

/**
 * Analyze project document and extract structured data (legacy - for local files)
 * Returns data with flags indicating which fields are from the document vs AI suggestions
 */
export async function analyzeProjectDocument(filePath, mimeType) {
  try {
    // Parse the document to extract text
    const documentText = await parseDocument(filePath, mimeType);

    if (!documentText || documentText.trim().length === 0) {
      throw new Error("Document is empty or could not be parsed");
    }

    // Use LangChain to extract structured data
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are an expert assistant that extracts structured project information from documents (proposals, project briefs, requirements documents, etc.).

Extract the following information from the provided document text. For each field:
- If the information is clearly stated in the document, extract it and set "source" to "document"
- If the information is not in the document but can be inferred, suggest a value and set "source" to "ai_suggestion"
- If the information cannot be determined, set the value to null and "source" to "missing"

Return ONLY valid JSON in this exact format:
{{
  "title": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "description": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "category": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "budgetMin": {{"value": number | null, "source": "document" | "ai_suggestion" | "missing"}},
  "budgetMax": {{"value": number | null, "source": "document" | "ai_suggestion" | "missing"}},
  "timelineAmount": {{"value": number | null, "source": "document" | "ai_suggestion" | "missing"}},
  "timelineUnit": {{"value": "day" | "week" | "month" | null, "source": "document" | "ai_suggestion" | "missing"}},
  "skills": {{"value": ["skill1", "skill2", ...], "source": "document" | "ai_suggestion" | "missing"}},
  "priority": {{"value": "low" | "medium" | "high" | null, "source": "document" | "ai_suggestion" | "missing"}},
  "requirements": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "deliverables": {{"value": "...", "source": "document" | "ai_suggestion" | "missing"}},
  "ndaSigned": {{"value": boolean | null, "source": "document" | "ai_suggestion" | "missing"}}
}}

Guidelines:
- For "category", use standard categories: WEB_DEVELOPMENT, MOBILE_APP_DEVELOPMENT, CLOUD_SERVICES, IOT_SOLUTIONS, DATA_ANALYTICS, CYBERSECURITY, UI_UX_DESIGN, DEVOPS, AI_ML_SOLUTIONS, SYSTEM_INTEGRATION, or a custom category name
- For "timelineUnit", infer from context (e.g., "2 weeks" -> {{"value": 2, "source": "document"}}, "timelineUnit": {{"value": "week", "source": "document"}})
- For "skills", extract all mentioned technologies, frameworks, tools, and programming languages
- For "requirements" and "deliverables", preserve the original text or markdown if present
- Be conservative: only mark as "document" if the information is explicitly stated
- For AI suggestions, provide reasonable defaults based on the document content and industry standards

Document Text:
{documentText}

Return ONLY valid JSON — no explanations, text, or code blocks.
`);

    const chain = RunnableSequence.from([prompt, model]);
    const result = await chain.invoke({ documentText });

    let content = result.content?.trim() || "";

    // Clean up any markdown or code fences
    if (content.startsWith("```json") || content.startsWith("```")) {
      content = content.replace(/```json|```/g, "").trim();
    }
    if (content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }

    try {
      const extracted = JSON.parse(content);
      
      // Validate and normalize the structure
      return {
        title: extracted.title || { value: null, source: "missing" },
        description: extracted.description || { value: null, source: "missing" },
        category: extracted.category || { value: null, source: "missing" },
        budgetMin: extracted.budgetMin || { value: null, source: "missing" },
        budgetMax: extracted.budgetMax || { value: null, source: "missing" },
        timelineAmount: extracted.timelineAmount || { value: null, source: "missing" },
        timelineUnit: extracted.timelineUnit || { value: null, source: "missing" },
        skills: extracted.skills || { value: [], source: "missing" },
        priority: extracted.priority || { value: "medium", source: "ai_suggestion" },
        requirements: extracted.requirements || { value: null, source: "missing" },
        deliverables: extracted.deliverables || { value: null, source: "missing" },
        ndaSigned: extracted.ndaSigned || { value: false, source: "ai_suggestion" },
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("AI returned invalid JSON format");
    }
  } catch (error) {
    console.error("Error analyzing project document:", error);
    throw error;
  }
}

