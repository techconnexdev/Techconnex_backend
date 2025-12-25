import multer from "multer";
import path from "path";
import fs from "fs";

// configurable base dir for milestone attachments
const MILESTONE_UPLOAD_DIR = process.env.MILESTONE_UPLOAD_DIR || "uploads/milestones";

// ensure directory exists
if (!fs.existsSync(MILESTONE_UPLOAD_DIR)) {
  fs.mkdirSync(MILESTONE_UPLOAD_DIR, { recursive: true });
}

// Multer storage: keep original filename but prefix timestamp to avoid collisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MILESTONE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ".pdf"
    const base = path.basename(file.originalname, ext); // "Work_Submission"
    const safeBase = base.replace(/[^a-z0-9_\-\.]/gi, "_"); // sanitize
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

// File filter (optional: allow only specific types)
const allowedMime = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
];

function fileFilter(req, file, cb) {
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type. Allowed types: PDF, DOC, DOCX, XLS, XLSX, ZIP, TXT, JPG, PNG"));
  }
}

// 10 MB per file limit
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const uploadMilestoneAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Only one attachment per milestone submission
  },
}).single("attachment");

