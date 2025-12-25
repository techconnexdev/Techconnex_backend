// src/modules/auth/KYC/controller.js
import {
  getKycDocumentByUserId,
  getReviewersByIds,
  updateKycDocumentStatus,
  updateUserVerificationStatus,
  getUserWithKycDocuments,
} from "./model.js";
import {
  createKycDocument,
  listKycDocuments,
  getKycDocument,
} from "./service.js";
import { createNotification } from "../../notifications/service.js";

export const createKyc = async (req, res) => {
  try {
    const { userId, type, key, url, filename, mimeType } = req.body;

    if (!userId || !type || !key) {
      return res
        .status(400)
        .json({ error: "userId, type, and key (R2 file key) are required" });
    }

    // Extract filename from key if not provided
    const finalFilename = filename || key.split("/").pop() || "kyc-document";
    
    // Use the R2 key as fileUrl (or the public URL if provided)
    const fileUrl = url || key;

    const newKyc = await createKycDocument({
      userId,
      type,
      fileUrl: fileUrl, // R2 key or public URL
      filename: finalFilename,
      mimeType: mimeType || "application/octet-stream",
      status: "uploaded",
    });

    res.status(201).json({
      success: true,
      data: newKyc,
    });
  } catch (error) {
    console.error("Error creating KYC:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllKyc = async (req, res) => {
  try {
    const documents = await listKycDocuments();

    // Preload all reviewers
    const reviewerIds = [
      ...new Set(documents.map((d) => d.reviewedBy).filter(Boolean)),
    ];
    const reviewers = await getReviewersByIds(reviewerIds);
    const reviewerMap = Object.fromEntries(
      reviewers.map((r) => [r.id, r.name])
    );

    const formatted = documents.map((doc) => {
      const { user } = doc;

      let profileType = null;
      let profile = null;

      if (user?.role?.includes("PROVIDER")) {
        profileType = "Provider";
        profile = user.providerProfile;
      } else if (user?.role?.includes("CUSTOMER")) {
        profileType = "Customer";
        profile = user.customerProfile;
      }

      return {
        id: doc.id,
        type: doc.type,
        status: doc.status,
        fileUrl: doc.fileUrl,
        filename: doc.filename,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        reviewedAt: doc.reviewedAt,
        reviewNotes: doc.reviewNotes,
        reviewedBy: doc.reviewedBy
          ? reviewerMap[doc.reviewedBy] || "Unknown Reviewer"
          : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          kycStatus: user.kycStatus,
          isVerified: user.isVerified,
          profileType,
          profile,
        },
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("🔥 Error fetching KYC list:", error);
    res.status(500).json({
      error: error.message || "Failed to load KYC documents",
    });
  }
};

export const reviewKycDocument = async (req, res) => {
  try {
    const { userId } = req.params;
    const { approve, notes } = req.body;

    const document = await getKycDocumentByUserId(userId);
    if (!document)
      return res.status(404).json({ error: "KYC document not found" });

    const status = approve ? "verified" : "rejected";

    // Get admin user ID from JWT payload (could be userId or id)
    const adminUserId = req.user?.userId || req.user?.id;

    // Update KYC document status
    await updateKycDocumentStatus(document.id, {
      status,
      reviewNotes: notes,
      reviewedAt: new Date(),
      reviewedBy: adminUserId,
    });

    // If document is verified, update user's isVerified status to true
    if (approve && status === "verified") {
      await updateUserVerificationStatus(userId, true);
    }

    // Create notification for the user
    try {
      if (approve && status === "verified") {
        await createNotification({
          userId: userId,
          title: "KYC Verification Approved",
          type: "system",
          content: `Your KYC verification has been approved. Your account is now verified.${notes ? ` Notes: ${notes}` : ""}`,
          metadata: {
            kycDocumentId: document.id,
            kycType: document.type,
            reviewedBy: adminUserId,
            action: "approved",
          },
        });
      } else {
        await createNotification({
          userId: userId,
          title: "KYC Verification Rejected",
          type: "system",
          content: `Your KYC verification has been rejected.${notes ? ` Reason: ${notes}` : " Please review your documents and resubmit."}`,
          metadata: {
            kycDocumentId: document.id,
            kycType: document.type,
            reviewedBy: adminUserId,
            action: "rejected",
            reviewNotes: notes,
          },
        });
      }
    } catch (notificationError) {
      // Log error but don't fail the KYC review
      console.error("Failed to create notification:", notificationError);
    }

    // Fetch updated user with all KYC documents formatted for response
    const updatedUser = await getUserWithKycDocuments(userId);
    
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};