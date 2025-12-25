import multer from "multer";
import path from "path";
import fs from "fs";

// configurable base dir
const DISPUTE_UPLOAD_DIR = process.env.DISPUTE_UPLOAD_DIR || "uploads/disputes";

// ensure directory exists
if (!fs.existsSync(DISPUTE_UPLOAD_DIR)) {
  fs.mkdirSync(DISPUTE_UPLOAD_DIR, { recursive: true });
}

// Multer storage: keep original filename but prefix timestamp to avoid collisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DISPUTE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ".pdf"
    const base = path.basename(file.originalname, ext); // "evidence"
    const safeBase = base.replace(/[^a-z0-9_\-\.]/gi, "_"); // sanitize
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

// File filter (optional: allow only specific types)
const allowedMime = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];
function fileFilter(req, file, cb) {
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"));
  }
}

// 10 MB per file limit (same as frontend)
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const uploadDisputeAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 5, // Allow up to 5 files
  },
}).array("attachments", 5); // <input name="attachments" multiple />

