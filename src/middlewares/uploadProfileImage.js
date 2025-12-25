import multer from "multer";
import path from "path";
import fs from "fs";

// configurable base dir
const PROFILE_IMAGE_UPLOAD_DIR = process.env.PROFILE_IMAGE_UPLOAD_DIR || "uploads/profile-images";

// ensure directory exists
if (!fs.existsSync(PROFILE_IMAGE_UPLOAD_DIR)) {
  fs.mkdirSync(PROFILE_IMAGE_UPLOAD_DIR, { recursive: true });
}

// Multer storage: keep original filename but prefix timestamp to avoid collisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROFILE_IMAGE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // ".jpg", ".png"
    const base = path.basename(file.originalname, ext); // "profile"
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

// 5 MB per file limit for profile images
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Only one profile image
  },
}).single("profileImage"); // <input name="profileImage" type="file" />

