import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class KycModel {
  // Get KYC documents for a user
  static async getKycDocuments(userId) {
    try {
      const documents = await prisma.kycDocument.findMany({
        where: { userId },
        orderBy: { uploadedAt: "desc" },
      });

      // Fetch reviewer info for each document
      const documentsWithReviewer = await Promise.all(
        documents.map(async (doc) => {
          if (!doc.reviewedBy) return { ...doc, reviewer: null };

          const reviewer = await prisma.user.findUnique({
            where: { id: doc.reviewedBy },
            select: { id: true, name: true, email: true },
          });

          return {
            ...doc,
            reviewer,
          };
        })
      );

      return documentsWithReviewer;
    } catch (error) {
      throw new Error(`Failed to get KYC documents: ${error.message}`);
    }
  }

  // Get KYC document by ID
  static async getKycDocumentById(documentId) {
    try {
      const document = await prisma.kycDocument.findUnique({
        where: { id: documentId },
      });

      return document;
    } catch (error) {
      throw new Error(`Failed to get KYC document: ${error.message}`);
    }
  }

  // Get user with enhanced data including KYC documents
  static async getUserWithKycData(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          kycStatus: true,
          isVerified: true,
          createdAt: true,
          KycDocument: {
            select: {
              id: true,
              type: true,
              fileUrl: true,
              filename: true,
              mimeType: true,
              status: true,
              reviewNotes: true,
              reviewedBy: true,
              uploadedAt: true,
              reviewedAt: true,
            },
            orderBy: {
              uploadedAt: "desc",
            },
          },
        },
      });

      return user;
    } catch (error) {
      throw new Error(`Failed to get user with KYC data: ${error.message}`);
    }
  }
}

export default KycModel;
