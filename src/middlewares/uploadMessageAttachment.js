import fs from "fs/promises";
import multer from "multer";
import path from "path";
import {
  uploadFileToR2,
  generateFileKey,
  getPublicUrl,
  r2Client,
  R2_BUCKET,
} from "../utils/r2.js";

// File filter: allow common file types for messages
const allowedMime = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
];

function fileFilter(req, file, cb) {
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "File type not allowed. Allowed types: images, PDF, Word, Excel, text files, and ZIP archives"
      )
    );
  }
}

// 25 MB per file limit for message attachments
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Use memory storage to get file buffer for R2 upload
const storage = multer.memoryStorage();

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Only one file at a time
  },
});

// Middleware to upload message attachment to R2
export const uploadMessageAttachment = async (req, res, next) => {
  // Use multer to handle file upload (stores in memory)
  upload.single("file")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          err.status = 400;
          err.message = "File is too large (maximum 25 MB for chat attachments).";
        } else {
          err.status = 400;
        }
      } else if (
        typeof err.message === "string" &&
        err.message.includes("File type not allowed")
      ) {
        err.status = 400;
      }
      return next(err);
    }

    // If no file was uploaded, continue (file is optional)
    if (!req.file) {
      return next();
    }

    try {
      // Get user ID from request (from auth middleware)
      const userId = req.user?.id || req.user?.userId;

      if (!userId) {
        return next(
          new Error("User ID is required for message attachment upload")
        );
      }

      // Generate R2 key with user ID in the path for organization
      const fileExt = path.extname(req.file.originalname);
      const fileName = path.basename(req.file.originalname, fileExt);
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const r2Key = generateFileKey(
        "message-attachments",
        `${sanitizedFileName}-${Date.now()}${fileExt}`,
        userId
      );

      const useR2 = Boolean(r2Client && R2_BUCKET);

      if (useR2) {
        await uploadFileToR2(req.file.buffer, r2Key, req.file.mimetype);

        let r2Url;
        try {
          r2Url = getPublicUrl(r2Key);
        } catch {
          console.warn("R2 public URL not configured, using key:", r2Key);
          r2Url = r2Key;
        }

        req.file.r2Key = r2Key;
        req.file.r2Url = r2Url;
        console.log("Message attachment uploaded to R2:", r2Key);
      } else {
        const uploadsRoot = path.join(process.cwd(), "uploads");
        const absolutePath = path.join(uploadsRoot, ...r2Key.split("/"));
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, req.file.buffer);
        req.file.r2Key = r2Key;
        req.file.r2Url = `/${["uploads", ...r2Key.split("/")].join("/")}`;
        console.warn(
          "Message attachment stored locally (R2 not configured). Serve via /uploads/…; set R2_* env vars for production.",
        );
      }

      next();
    } catch (error) {
      console.error("Error storing message attachment:", error);
      const e = new Error(
        `Failed to store attachment: ${error.message || "Unknown error"}`,
      );
      e.status = 500;
      return next(e);
    }
  });
};
