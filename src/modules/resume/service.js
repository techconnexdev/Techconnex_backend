import {
  saveResumeRecord,
} from "./model.js";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { downloadFileFromR2 } from "../../utils/r2.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export const uploadResumeFile = async (userId, fileUrl) => {
  const saved = await saveResumeRecord(userId, fileUrl);
  return saved;
};

export const summarizeFullResume = async (r2Key) => {
  // Download PDF from R2
  let pdfBuffer;
  
  try {
    console.log("Downloading resume from R2:", r2Key);
    pdfBuffer = await downloadFileFromR2(r2Key);
    
    // Parse PDF text from buffer
    const text = await parseResumeTextFromBuffer(pdfBuffer);

    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`
You're an expert assistant that extracts structured JSON data from resumes.

Extract the following information from the provided resume text:

{{
  "bio": "...",
  "skills": ["..."],
  "languages": ["..."],
  "yearsExperience": "...",
  "suggestedHourlyRate": "...",
  "certifications": [
    {{
      "name": "...",
      "issuer": "...",
      "issuedDate": "...",
      "serialNumber": "...",
      "verificationLink": "..."
    }}
  ],
  "portfolioUrls": ["..."],
  "officialWebsite": "...",
  "location": "..."
}}
Resume:
{resumeText}
Return ONLY valid JSON — no explanations, text, or code blocks.
`);

    const chain = RunnableSequence.from([prompt, model]);
    const result = await chain.invoke({ resumeText: text });

    let content = result.content?.trim();

    // Clean up stray code fences
    if (content.startsWith("```json") || content.startsWith("```")) {
      content = content.replace(/```json|```/g, "").trim();
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("AI returned invalid JSON format");
    }
  } catch (error) {
    console.error("Error processing resume from R2:", error);
    throw error;
  }
};

// Helper function to parse PDF from buffer (instead of file path)
const parseResumeTextFromBuffer = async (pdfBuffer) => {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing resume from buffer:", error);
    throw error;
  }
};

