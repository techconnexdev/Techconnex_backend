import multer from "multer";
import path from "path";
import fs from "fs";

// configurable base dir for portfolio images/files
const PORTFOLIO_UPLOAD_DIR = process.env.PORTFOLIO_UPLOAD_DIR || "uploads/portfolio";

// ensure directory exists
if (!fs.existsSync(PORTFOLIO_UPLOAD_DIR)) {
  fs.mkdirSync(PORTFOLIO_UPLOAD_DIR, { recursive: true });
}

// Multer storage: keep original filename but prefix timestamp to avoid collisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PORTFOLIO_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ".jpg", ".pdf"
    const base = path.basename(file.originalname, ext); // "project_image"
    const safeBase = base.replace(/[^a-z0-9_\-\.]/gi, "_"); // sanitize
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

// File filter: allow images and common document types
const allowedMime = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
];

function fileFilter(req, file, cb) {
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type. Allowed types: Images (JPG, PNG, GIF, WebP), PDF, DOC, DOCX, XLS, XLSX, ZIP, TXT"));
  }
}

// 10 MB per file limit
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const uploadPortfolioImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Only one file per portfolio item
  },
}).single("portfolioImage"); // <input name="portfolioImage" type="file" />

