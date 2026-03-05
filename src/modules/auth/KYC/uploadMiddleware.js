import multer from "multer";
import { uploadFileToR2, generateFileKey } from "../../../utils/r2.js";
import { createKycDocument } from "./service.js";

const allowedMime = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed. Use PDF, images, or Word/Excel/text."));
    }
  },
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
});

/**
 * POST /kyc/upload handler: multipart form with "type" and "documents" (files).
 * Uploads each file to R2, then creates KYC record. Requires authenticated user (userId from token).
 */
export const uploadKycFiles = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const type = (req.body?.type || "").toUpperCase();
    const validTypes = ["PROVIDER_ID", "COMPANY_REG", "COMPANY_DIRECTOR_ID", "OTHER"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid type. Use PROVIDER_ID, COMPANY_REG, COMPANY_DIRECTOR_ID, or OTHER." });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "No documents uploaded" });
    }

    const created = [];
    for (const file of files) {
      const key = generateFileKey("kyc", file.originalname, userId);
      await uploadFileToR2(file.buffer, key, file.mimetype || "application/octet-stream");
      const doc = await createKycDocument({
        userId,
        type,
        fileUrl: key,
        filename: file.originalname || key.split("/").pop() || "kyc-document",
        mimeType: file.mimetype || "application/octet-stream",
        status: "uploaded",
      });
      created.push(doc);
    }

    res.status(201).json({ success: true, data: created, message: "KYC document(s) uploaded" });
  } catch (error) {
    console.error("KYC upload error:", error);
    res.status(500).json({ success: false, message: error.message || "KYC upload failed" });
  }
};

export const uploadKycMulter = upload.array("documents", 5);
