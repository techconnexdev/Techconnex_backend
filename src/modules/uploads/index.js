// modules/uploads/index.js
import express from "express";
import { authenticateToken } from "../../middlewares/auth.js";
import jwt from "jsonwebtoken";
import { 
  generatePresignedUploadUrl, 
  generateFileKey, 
  validateFile, 
  getPublicUrl,
  generatePresignedDownloadUrl 
} from "../../utils/r2.js";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Optional authentication middleware (for registration flows)
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    // No token - proceed without authentication (for registration)
    req.user = null;
    return next();
  }

  // If token exists, verify it
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      // Invalid token - proceed without authentication (for registration)
      req.user = null;
      return next();
    }

    // ✅ Normalize both possible token formats
    if (payload.userId && !payload.id) {
      payload.id = payload.userId;
    }

    // ✅ Ensure roles array
    if (Array.isArray(payload.role)) {
      payload.roles = payload.role;
    } else if (payload.role) {
      payload.roles = [payload.role];
    } else {
      payload.roles = [];
    }

    req.user = payload;
    next();
  });
};

/**
 * POST /uploads/presigned-url
 * Generate a presigned URL for uploading a file to R2
 * 
 * Body:
 * {
 *   fileName: string (required)
 *   mimeType: string (required)
 *   fileSize: number (required, in bytes)
 *   prefix: string (optional, default: "uploads")
 *   visibility: "public" | "private" (optional, default: "private")
 *   category: "image" | "document" | "video" (optional, auto-detected from mimeType)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   uploadUrl: string (presigned URL for upload),
 *   key: string (R2 object key),
 *   accessUrl?: string (public URL, only if visibility is "public")
 * }
 */
// Presigned URL endpoint - authentication is optional for registration flows
router.post("/presigned-url", optionalAuthenticate, async (req, res) => {
  try {
    const { fileName, mimeType, fileSize, prefix = "uploads", visibility = "private", category } = req.body;

    // Validate required fields
    if (!fileName || !mimeType || fileSize === undefined || fileSize === null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: fileName, mimeType, and fileSize are required",
      });
    }

    // Ensure fileSize is a number
    const numericFileSize = Number(fileSize);
    if (isNaN(numericFileSize) || numericFileSize < 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid fileSize: ${fileSize} (must be a positive number)`,
      });
    }

    // Validate file
    try {
      validateFile(fileName, mimeType, numericFileSize, category);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Get user ID from token (if authenticated) or use temporary ID for registration
    let userId = req.user?.userId || req.user?.id;
    
    // If no user ID (registration flow), use a temporary identifier
    // This will be replaced with actual user ID after registration
    if (!userId) {
      // Use timestamp-based temporary ID for registration uploads
      userId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Generate unique file key
    const key = generateFileKey(prefix, fileName, userId);

    // Generate presigned upload URL (expires in 5 minutes)
    const uploadUrl = await generatePresignedUploadUrl(key, mimeType, 300);

    // Prepare response
    const response = {
      success: true,
      uploadUrl,
      key,
    };

    // If public, include the public URL
    if (visibility === "public") {
      try {
        response.accessUrl = getPublicUrl(key);
      } catch (error) {
        // If public URL generation fails, still return the upload URL
        console.warn("Failed to generate public URL:", error.message);
      }
    }

    res.json(response);
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate presigned URL",
    });
  }
});

/**
 * GET /uploads/download
 * Get a presigned download URL for a private file
 * Checks permissions before generating the URL
 * 
 * Query params:
 * - key: string (required) - R2 object key
 * - expiresIn?: number (optional, default: 3600) - URL expiration in seconds
 * 
 * Response:
 * {
 *   success: true,
 *   downloadUrl: string (presigned URL for download),
 *   expiresIn: number (seconds until expiration)
 * }
 */
router.get("/download", authenticateToken, async (req, res) => {
  try {
    const { key, expiresIn = 3600 } = req.query;

    // Validate required fields
    if (!key || typeof key !== "string") {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: key",
      });
    }

    // Get user ID from token
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    // Check if user is an admin - admins have access to all files
    const userRoles = req.user?.roles || req.user?.role || [];
    const isAdmin = Array.isArray(userRoles) 
      ? userRoles.includes("ADMIN") 
      : userRoles === "ADMIN";

    // Check permissions: user can download files they own OR files they have access to through shared resources
    // File keys are structured as: prefix/userId/timestamp-random-filename
    // So we check if the key contains the user's ID
    const ownsFile = key.includes(`/${userId}/`) || key.startsWith(`${userId}/`);
    
    // Admins can access any file, skip permission checks
    if (!isAdmin && !ownsFile) {
      // Check if user has access through shared resources (proposals, milestones, etc.)
      let hasAccess = false;
      
      // Check for proposal attachments: 
      // 1. Providers can access their own proposal attachments
      // 2. Companies can access provider's proposal attachments for their service requests
      // 3. Both can access proposal attachments for projects they're involved in
      // Normalize key: handle both forward and backslashes, and both "proposals/" and "uploads/proposals/" formats
      const normalizedKey = key.replace(/\\/g, "/");
      const isProposalKey = normalizedKey.includes("/proposals/") || normalizedKey.startsWith("proposals/");
      
      if (isProposalKey) {
        // Extract provider ID from key (format: proposals/providerId/timestamp-random-filename or uploads/proposals/providerId/...)
        const keyParts = normalizedKey.split("/");
        // Find the index of "proposals" in the path
        const proposalsIndex = keyParts.findIndex(part => part === "proposals");
        if (proposalsIndex >= 0 && keyParts.length > proposalsIndex + 1) {
          const providerIdFromKey = keyParts[proposalsIndex + 1];
          
          // Quick check: If providerId from key matches userId, grant access immediately
          // This handles the common case of providers accessing their own files
          if (String(providerIdFromKey) === String(userId)) {
            hasAccess = true;
          }
          
          // Extract filename from key for additional matching
          const filename = normalizedKey.split("/").pop() || key.split(/[\\/]/).pop();
          
          // Find ANY proposal that contains this key in attachmentUrls
          // (The key might be stored as-is or as part of a URL)
          const proposal = await prisma.proposal.findFirst({
            where: {
              OR: [
                {
                  attachmentUrls: {
                    has: key, // Exact match in array (original key)
                  },
                },
                {
                  attachmentUrls: {
                    has: normalizedKey, // Exact match with normalized key (forward slashes)
                  },
                },
                {
                  attachmentUrls: {
                    hasSome: key.split(/[\\/]/).filter(p => p && p !== "uploads" && p !== "proposals"), // Check if any part matches
                  },
                },
                {
                  attachmentUrl: {
                    contains: key, // Partial match for single attachmentUrl field (legacy)
                  },
                },
                {
                  attachmentUrl: {
                    contains: normalizedKey, // Partial match with normalized key
                  },
                },
                {
                  attachmentUrl: {
                    contains: filename, // Match by filename
                  },
                },
                // Also check if any attachmentUrl in the array contains the filename
                ...(filename ? [{
                  attachmentUrls: {
                    hasSome: [filename],
                  },
                }] : []),
              ],
            },
            include: {
              serviceRequest: {
                select: {
                  customerId: true,
                  projectId: true,
                },
              },
              Milestone: {
                select: {
                  project: {
                    select: {
                      id: true,
                      customerId: true,
                      providerId: true,
                    },
                  },
                },
              },
            },
          });
          
          if (proposal) {
            // Check if user is the provider who created this proposal
            if (String(proposal.providerId) === String(userId)) {
              hasAccess = true;
            }
            // Check if user is the customer for this service request
            else if (String(proposal.serviceRequest.customerId) === String(userId)) {
              hasAccess = true;
            }
            // Check if service request is linked to a project where user is customer or provider
            else if (proposal.serviceRequest.projectId) {
              const project = await prisma.project.findUnique({
                where: { id: proposal.serviceRequest.projectId },
                select: {
                  customerId: true,
                  providerId: true,
                },
              });
              if (project && (String(project.customerId) === String(userId) || String(project.providerId) === String(userId))) {
                hasAccess = true;
              }
            }
            // Check if proposal is linked to a project through milestones
            else if (proposal.Milestone && proposal.Milestone.length > 0) {
              const projectMilestone = proposal.Milestone.find(
                (m) => m.project
              );
              if (projectMilestone?.project) {
                const project = projectMilestone.project;
                if (String(project.customerId) === String(userId) || String(project.providerId) === String(userId)) {
                  hasAccess = true;
                }
              }
            }
          }
          
          // If still no access and providerId from key matches userId, grant access
          // (This is a fallback in case the proposal wasn't found in DB but key format matches)
          if (!hasAccess && String(providerIdFromKey) === String(userId)) {
            hasAccess = true;
          }
        }
      }
      
      // Check for milestone attachments: both companies and providers should access milestone attachments for their projects
      if (!hasAccess && key.startsWith("milestones/")) {
        // Extract provider ID from key (format: milestones/providerId/timestamp-random-filename)
        const keyParts = key.split("/");
        if (keyParts.length >= 2) {
          const fileProviderId = keyParts[1];
          
          // Find milestones with this submission attachment URL in projects where user is either customer or provider
          const milestone = await prisma.milestone.findFirst({
            where: {
              OR: [
                {
                  project: {
                    customerId: userId,
                    providerId: fileProviderId,
                  },
                },
                {
                  project: {
                    providerId: userId,
                    customerId: fileProviderId,
                  },
                },
              ],
              submissionAttachmentUrl: key,
            },
          });
          
          if (milestone) {
            hasAccess = true;
          }
        }
      }
      
      // Check for dispute attachments: both companies and providers should access dispute attachments for their projects
      if (!hasAccess && key.startsWith("disputes/")) {
        // Extract user ID from key (format: disputes/userId/timestamp-random-filename)
        const keyParts = key.split("/");
        if (keyParts.length >= 2) {
          const fileUserId = keyParts[1];
          
          // Find disputes with this attachment URL in projects where user is either customer or provider
          const dispute = await prisma.dispute.findFirst({
            where: {
              attachments: {
                has: key, // Check if the key is in the attachments array
              },
              project: {
                OR: [
                  {
                    customerId: userId,
                  },
                  {
                    providerId: userId,
                  },
                ],
              },
            },
          });
          
          if (dispute) {
            hasAccess = true;
          }
        }
      }
      
      // Check for KYC documents: users can access their own KYC documents, admins can access all (already checked above)
      if (!hasAccess && key.startsWith("kyc/")) {
        // Extract user ID from key (format: kyc/userId/timestamp-random-filename)
        const keyParts = key.split("/");
        if (keyParts.length >= 2) {
          const fileUserId = keyParts[1];
          
          // User can access their own KYC documents
          if (fileUserId === userId) {
            hasAccess = true;
          } else {
            // Check if the file is associated with a KYC document for this user
            const kycDoc = await prisma.kycDocument.findFirst({
              where: {
                fileUrl: { contains: key },
                userId: userId, // User owns the KYC document
              },
            });
            if (kycDoc) {
              hasAccess = true;
            }
          }
        }
      }
      
      // Check for resume documents: users can access their own resumes, companies and admins can access provider resumes
      if (!hasAccess && key.startsWith("resumes/")) {
        // Extract user ID from key (format: resumes/userId/timestamp-random-filename)
        const keyParts = key.split("/");
        if (keyParts.length >= 2) {
          const fileUserId = keyParts[1];
          
          // User can access their own resume
          if (fileUserId === userId) {
            hasAccess = true;
          } else {
            // Check if the file is associated with a resume for this user
            const resume = await prisma.resume.findFirst({
              where: {
                fileUrl: { contains: key },
                userId: userId, // User owns the resume
              },
            });
            if (resume) {
              hasAccess = true;
            } else {
              // Check if user is a company (CUSTOMER) or admin - they can access provider resumes
              const isCustomer = Array.isArray(userRoles) 
                ? userRoles.includes("CUSTOMER") 
                : userRoles === "CUSTOMER";
              
              // Companies and admins can access any provider's resume
              // Verify that the fileUserId is a provider by checking if they have a provider profile
              if (isCustomer || isAdmin) {
                const providerProfile = await prisma.providerProfile.findUnique({
                  where: { userId: fileUserId },
                });
                if (providerProfile) {
                  hasAccess = true;
                }
              }
            }
          }
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have permission to access this file.",
        });
      }
    }

    // Validate expiresIn
    const expiresInSeconds = parseInt(expiresIn, 10);
    if (isNaN(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 86400) {
      return res.status(400).json({
        success: false,
        message: "expiresIn must be between 60 and 86400 seconds (1 minute to 24 hours)",
      });
    }

    // Generate presigned download URL
    const downloadUrl = await generatePresignedDownloadUrl(key, expiresInSeconds);

    res.json({
      success: true,
      downloadUrl,
      expiresIn: expiresInSeconds,
    });
  } catch (error) {
    console.error("Error generating download URL:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate download URL",
    });
  }
});

export default router;

