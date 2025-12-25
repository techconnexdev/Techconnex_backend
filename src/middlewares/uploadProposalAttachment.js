import multer from "multer";
import path from "path";
import fs from "fs";

// configurable base dir
const PROPOSAL_UPLOAD_DIR = process.env.PROPOSAL_UPLOAD_DIR || "uploads/proposals";

// ensure directory exists
if (!fs.existsSync(PROPOSAL_UPLOAD_DIR)) {
  fs.mkdirSync(PROPOSAL_UPLOAD_DIR, { recursive: true });
}

// Multer storage: keep original filename but prefix timestamp to avoid collisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROPOSAL_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ".pdf"
    const base = path.basename(file.originalname, ext); // "CV Hasan"
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

export const uploadProposalAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 3,
  },
}).array("attachments", 3); // <input name="attachments" multiple />
