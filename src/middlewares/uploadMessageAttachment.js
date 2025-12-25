import multer from "multer";
import path from "path";
import { uploadFileToR2, generateFileKey, getPublicUrl } from "../utils/r2.js";

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

      // Upload file buffer to R2
      await uploadFileToR2(req.file.buffer, r2Key, req.file.mimetype);

      // Get public URL or use the key (depending on your R2 setup)
      let r2Url;
      try {
        r2Url = getPublicUrl(r2Key);
      } catch (error) {
        // If public URL is not configured, use the key as reference
        console.warn("R2 public URL not configured, using key:", r2Key);
        r2Url = r2Key;
      }

      // Attach R2 URL to req.file for use in controllers
      req.file.r2Key = r2Key;
      req.file.r2Url = r2Url;

      console.log("Message attachment uploaded to R2:", r2Key);
      next();
    } catch (error) {
      console.error("Error uploading message attachment to R2:", error);
      return next(new Error(`Failed to upload file to R2: ${error.message}`));
    }
  });
};
