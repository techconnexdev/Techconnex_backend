import multer from "multer";
import path from "path";
import { uploadFileToR2, generateFileKey, getPublicUrl } from "../utils/r2.js";

// File filter: allow only image types and PDF
const allowedMime = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

function fileFilter(req, file, cb) {
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) and PDF files are allowed"));
  }
}

// 10 MB per file limit for bank transfer reference images/documents
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Use memory storage to get file buffer for R2 upload
const storage = multer.memoryStorage();

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Only one file
  },
});

// Middleware to upload file to R2 after multer processes it
export const uploadBankTransferRef = async (req, res, next) => {
  // Use multer to handle file upload (stores in memory)
  upload.single("bankTransferRefImage")(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    // If no file was uploaded, continue (file is optional)
    if (!req.file) {
      return next();
    }

    try {
      // Generate R2 key for the file
      const fileExt = path.extname(req.file.originalname);
      const fileName = path.basename(req.file.originalname, fileExt);
      const r2Key = generateFileKey("bank-transfer-refs", `${fileName}${fileExt}`);

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

      console.log("Bank transfer ref uploaded to R2:", r2Key);
      next();
    } catch (error) {
      console.error("Error uploading bank transfer ref to R2:", error);
      return next(new Error(`Failed to upload file to R2: ${error.message}`));
    }
  });
};

