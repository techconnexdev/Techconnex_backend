// utils/r2.js
import { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Validate required environment variables
const requiredEnvVars = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(
    `⚠️  Missing R2 environment variables: ${missingVars.join(", ")}. R2 uploads will not work.`
  );
} else {
  // Log endpoint configuration (without sensitive data)
  const endpoint = process.env.R2_ENDPOINT;
  console.log(`✅ R2 configured with endpoint: ${endpoint ? endpoint.replace(/\/\/.*@/, "//***@") : "NOT SET"}`);
}

// Normalize R2 endpoint to ensure HTTPS
function normalizeR2Endpoint(endpoint) {
  if (!endpoint) return null;
  
  // Remove trailing slash
  endpoint = endpoint.trim().replace(/\/$/, "");
  
  // Ensure it starts with https://
  if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
    endpoint = `https://${endpoint}`;
  }
  
  // Force HTTPS (replace http:// with https://)
  endpoint = endpoint.replace(/^http:\/\//, "https://");
  
  return endpoint;
}

// Initialize R2 client (Cloudflare R2 is S3-compatible)
// Only initialize if all required vars are present
const normalizedEndpoint = normalizeR2Endpoint(process.env.R2_ENDPOINT);
const r2Client = missingVars.length === 0 && normalizedEndpoint
  ? new S3Client({
      region: "auto", // R2 uses "auto" as the region
      endpoint: normalizedEndpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Use path-style URLs for R2 (bucket in path, not subdomain)
    })
  : null;

// R2 bucket name
const R2_BUCKET = process.env.R2_BUCKET_NAME;

// Size limits (in bytes)
const MAX_FILE_SIZE = {
  image: 10 * 1024 * 1024, // 10 MB for images
  document: 50 * 1024 * 1024, // 50 MB for documents
  video: 100 * 1024 * 1024, // 100 MB for videos
  default: 50 * 1024 * 1024, // 50 MB default
};

// Allowed MIME types by category
const ALLOWED_MIME_TYPES = {
  image: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "text/plain",
    "text/csv",
  ],
  video: [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ],
};

/**
 * Get file category from MIME type
 */
function getFileCategory(mimeType) {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return "image";
  if (ALLOWED_MIME_TYPES.document.includes(mimeType)) return "document";
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return "video";
  return "default";
}

/**
 * Validate file size and type
 */
export function validateFile(fileName, mimeType, fileSize, category = null) {
  // Determine category if not provided
  const fileCategory = category || getFileCategory(mimeType);

  // Check MIME type
  const allowedTypes = ALLOWED_MIME_TYPES[fileCategory] || ALLOWED_MIME_TYPES.default;
  if (!allowedTypes.includes(mimeType)) {
    throw new Error(
      `File type not allowed. Allowed types for ${fileCategory}: ${allowedTypes.join(", ")}`
    );
  }

  // Check file size
  const maxSize = MAX_FILE_SIZE[fileCategory] || MAX_FILE_SIZE.default;
  if (fileSize > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    throw new Error(
      `File size exceeds limit. Maximum size for ${fileCategory} is ${maxSizeMB} MB`
    );
  }

  return { fileCategory, maxSize };
}

/**
 * Generate a unique key for the file
 */
export function generateFileKey(prefix, fileName, userId = null) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  
  // Structure: prefix/userId/timestamp-random-filename (if userId provided)
  // or: prefix/timestamp-random-filename (if no userId)
  if (userId) {
    return `${prefix}/${userId}/${timestamp}-${random}-${sanitizedFileName}`;
  }
  return `${prefix}/${timestamp}-${random}-${sanitizedFileName}`;
}

/**
 * Generate presigned URL for upload
 * @param {string} key - R2 object key
 * @param {string} mimeType - File MIME type
 * @param {number} expiresIn - URL expiration in seconds (default: 300 = 5 minutes)
 * @returns {Promise<string>} Presigned URL
 */
export async function generatePresignedUploadUrl(key, mimeType, expiresIn = 300) {
  if (!r2Client || !R2_BUCKET) {
    throw new Error("R2 is not configured. Please set R2 environment variables.");
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  try {
    const url = await getSignedUrl(r2Client, command, { expiresIn });
    
    // Log the generated URL for debugging (truncated)
    console.log(`🔗 Generated presigned URL: ${url.substring(0, 80)}...`);
    
    // Validate that the URL uses HTTPS
    if (!url.startsWith("https://")) {
      console.warn(`⚠️  Presigned URL does not use HTTPS: ${url.substring(0, 50)}...`);
      // Force HTTPS if it's using HTTP
      const httpsUrl = url.replace(/^http:\/\//, "https://");
      return httpsUrl;
    }
    
    // Check if URL is using the wrong endpoint (public domain instead of API endpoint)
    if (url.includes(".r2.dev") && !url.includes("r2.cloudflarestorage.com")) {
      console.error(`❌ ERROR: Presigned URL is using public domain (.r2.dev) instead of API endpoint!`);
      console.error(`   URL: ${url.substring(0, 100)}...`);
      console.error(`   Expected endpoint: ${normalizedEndpoint}`);
      console.error(`   Please check your R2_ENDPOINT in .env file and restart the server.`);
      throw new Error("Presigned URL is using incorrect endpoint. Check R2_ENDPOINT configuration.");
    }
    
    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

/**
 * Generate presigned URL for download (for private files)
 * @param {string} key - R2 object key
 * @param {number} expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function generatePresignedDownloadUrl(key, expiresIn = 3600) {
  if (!r2Client || !R2_BUCKET) {
    throw new Error("R2 is not configured. Please set R2 environment variables.");
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  const url = await getSignedUrl(r2Client, command, { expiresIn });
  return url;
}

/**
 * Download a file from R2
 * @param {string} key - R2 object key
 * @returns {Promise<Buffer>} File buffer
 */
export async function downloadFileFromR2(key) {
  if (!r2Client || !R2_BUCKET) {
    throw new Error("R2 is not configured. Please set R2 environment variables.");
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const response = await r2Client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error downloading file from R2:", error);
    throw new Error(`Failed to download file from R2: ${error.message}`);
  }
}

/**
 * Get public URL for a file (if bucket is public)
 * @param {string} key - R2 object key
 * @returns {string} Public URL
 */
export function getPublicUrl(key) {
  // R2 public URL format: https://<bucket-name>.<account-id>.r2.cloudflarestorage.com/<key>
  // Or if using custom domain: https://<custom-domain>/<key>
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  
  if (publicDomain) {
    // Custom domain configured
    return `https://${publicDomain}/${key}`;
  }
  
  // Default R2 public URL (requires public bucket)
  const accountId = process.env.R2_ACCOUNT_ID;
  if (accountId && R2_BUCKET) {
    return `https://${R2_BUCKET}.${accountId}.r2.cloudflarestorage.com/${key}`;
  }
  
  throw new Error("R2 public URL configuration missing. Set R2_PUBLIC_DOMAIN or R2_ACCOUNT_ID.");
}

/**
 * Upload file directly to R2 (for server-side uploads)
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} key - R2 object key
 * @param {string} mimeType - File MIME type
 * @returns {Promise<void>}
 */
export async function uploadFileToR2(fileBuffer, key, mimeType) {
  if (!r2Client || !R2_BUCKET) {
    throw new Error("R2 is not configured. Please set R2 environment variables.");
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await r2Client.send(command);
}

export { r2Client, R2_BUCKET, MAX_FILE_SIZE, ALLOWED_MIME_TYPES };

