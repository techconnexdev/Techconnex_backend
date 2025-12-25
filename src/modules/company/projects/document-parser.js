// src/modules/company/projects/document-parser.js
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * Parse PDF from buffer and extract text
 */
export async function parsePDFFromBuffer(dataBuffer) {
  try {
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw error;
  }
}

/**
 * Parse PDF file and extract text (legacy - for local files)
 */
export async function parsePDF(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    return await parsePDFFromBuffer(dataBuffer);
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw error;
  }
}

/**
 * Parse TXT from buffer and extract text
 */
export async function parseTXTFromBuffer(dataBuffer) {
  try {
    const text = dataBuffer.toString("utf-8");
    return text;
  } catch (error) {
    console.error("Error parsing TXT:", error);
    throw error;
  }
}

/**
 * Parse TXT file and extract text (legacy - for local files)
 */
export async function parseTXT(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const text = fs.readFileSync(filePath, "utf-8");
    return text;
  } catch (error) {
    console.error("Error parsing TXT:", error);
    throw error;
  }
}

/**
 * Parse Word document (DOCX) from buffer - requires mammoth package
 */
export async function parseDOCXFromBuffer(dataBuffer) {
  try {
    // Try to use mammoth if available
    let mammoth;
    try {
      mammoth = require("mammoth");
    } catch (requireError) {
      throw new Error("Word document parsing requires the 'mammoth' package. Please install it: npm install mammoth");
    }

    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    return result.value;
  } catch (error) {
    console.error("Error parsing Word document:", error);
    throw error;
  }
}

/**
 * Parse Word document (DOCX) - requires mammoth package (legacy - for local files)
 */
export async function parseDOCX(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Try to use mammoth if available
    let mammoth;
    try {
      mammoth = require("mammoth");
    } catch (requireError) {
      throw new Error("Word document parsing requires the 'mammoth' package. Please install it: npm install mammoth");
    }

    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error("Error parsing Word document:", error);
    throw error;
  }
}

/**
 * Parse Excel file (XLSX) from buffer - requires xlsx package
 */
export async function parseXLSXFromBuffer(dataBuffer) {
  try {
    // Try to use xlsx if available
    let XLSX;
    try {
      XLSX = require("xlsx");
    } catch (requireError) {
      throw new Error("Excel file parsing requires the 'xlsx' package. Please install it: npm install xlsx");
    }

    const workbook = XLSX.read(dataBuffer, { type: "buffer" });
    let text = "";

    // Extract text from all sheets
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_csv(sheet);
      text += `Sheet: ${sheetName}\n${sheetText}\n\n`;
    });

    return text;
  } catch (error) {
    console.error("Error parsing Excel file:", error);
    throw error;
  }
}

/**
 * Parse Excel file (XLSX) - requires xlsx package (legacy - for local files)
 */
export async function parseXLSX(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Try to use xlsx if available
    let XLSX;
    try {
      XLSX = require("xlsx");
    } catch (requireError) {
      throw new Error("Excel file parsing requires the 'xlsx' package. Please install it: npm install xlsx");
    }

    const workbook = XLSX.readFile(filePath);
    let text = "";

    // Extract text from all sheets
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_csv(sheet);
      text += `Sheet: ${sheetName}\n${sheetText}\n\n`;
    });

    return text;
  } catch (error) {
    console.error("Error parsing Excel file:", error);
    throw error;
  }
}

/**
 * Parse document from buffer based on MIME type
 */
export async function parseDocumentFromBuffer(dataBuffer, mimeType, fileName) {
  const extension = fileName?.split(".").pop()?.toLowerCase() || "";
  const mimeLower = mimeType?.toLowerCase() || "";

  // Determine file type
  if (extension === "pdf" || mimeLower.includes("pdf")) {
    return await parsePDFFromBuffer(dataBuffer);
  } else if (extension === "txt" || mimeLower.includes("text/plain")) {
    return await parseTXTFromBuffer(dataBuffer);
  } else if (extension === "docx" || mimeLower.includes("word") || mimeLower.includes("document")) {
    return await parseDOCXFromBuffer(dataBuffer);
  } else if (extension === "xlsx" || extension === "xls" || mimeLower.includes("spreadsheet") || mimeLower.includes("excel")) {
    return await parseXLSXFromBuffer(dataBuffer);
  } else {
    // Default to text parsing
    return await parseTXTFromBuffer(dataBuffer);
  }
}

/**
 * Parse document based on file extension (legacy - for local files)
 */
export async function parseDocument(filePath, mimeType) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  const mimeLower = mimeType?.toLowerCase() || "";

  // Determine file type
  if (extension === "pdf" || mimeLower.includes("pdf")) {
    return await parsePDF(filePath);
  } else if (extension === "txt" || mimeLower.includes("text/plain")) {
    return await parseTXT(filePath);
  } else if (extension === "docx" || mimeLower.includes("word") || mimeLower.includes("document")) {
    return await parseDOCX(filePath);
  } else if (extension === "xlsx" || extension === "xls" || mimeLower.includes("spreadsheet") || mimeLower.includes("excel")) {
    return await parseXLSX(filePath);
  } else {
    // Default to text parsing
    return await parseTXT(filePath);
  }
}

