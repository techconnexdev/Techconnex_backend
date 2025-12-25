import multer from "multer";
import path from "path";
import fs from "fs";

// configurable base dir
const MEDIA_COMPANY_UPLOAD_DIR = process.env.MEDIA_COMPANY_UPLOAD_DIR || "uploads/media-company";

// ensure directory exists
if (!fs.existsSync(MEDIA_COMPANY_UPLOAD_DIR)) {
  fs.mkdirSync(MEDIA_COMPANY_UPLOAD_DIR, { recursive: true });
}

// Multer storage: keep original filename but prefix timestamp to avoid collisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_COMPANY_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ".jpg", ".png"
    const base = path.basename(file.originalname, ext); // "image"
    const safeBase = base.replace(/[^a-z0-9_\-\.]/gi, "_"); // sanitize
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

// File filter: allow only image types
const allowedMime = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

function fileFilter(req, file, cb) {
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (JPEG, PNG, GIF, WebP)"));
  }
}

// 10 MB per file limit for media gallery images
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const uploadCompanyMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 10, // Allow up to 10 images
  },
}).array("mediaImages", 10); // <input name="mediaImages" multiple />

