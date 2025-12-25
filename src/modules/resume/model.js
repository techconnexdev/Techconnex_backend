import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// This function is kept for backward compatibility but may not be used anymore
// The new flow uses parseResumeTextFromBuffer in service.js
export const parseResumeText = async (pdfPath) => {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`File not found: ${pdfPath}`);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);

    return data.text;
  } catch (error) {
    console.error("Error parsing resume:", error);
    throw error;
  }
};

export const saveResumeRecord = async (userId, fileUrl) => {
  return prisma.resume.upsert({
    where: { userId },
    update: { fileUrl, uploadedAt: new Date() },
    create: { userId, fileUrl },
  });
};

export const getResumeByUserId = async (userId) => {
  return prisma.resume.findUnique({ where: { userId } });
};

export const updateResumeDescription = async (userId, description) => {
  return prisma.resume.update({
    where: { userId },
    data: { description },
  });
};

export const getResumeStoragePath = () => {
  const uploadDir = path.resolve("uploads/resumes");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
};

export const deleteResumeRecord = async (userId) => {
  return prisma.resume.delete({
    where: { userId },
  });
};