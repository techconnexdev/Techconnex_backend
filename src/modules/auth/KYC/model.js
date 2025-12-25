import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ✅ Create new KYC Document
export const createKycDocumentInDB = async (data) => {
  return await prisma.kycDocument.create({
    data: {
      userId: data.userId,
      type: data.type,
      fileUrl: data.fileUrl,
      filename: data.filename,
      mimeType: data.mimeType,
      status: data.status,
    },
  });
};

// ✅ Get all KYC Documents with user + related profile
export const getAllKycDocuments = async () => {
  return await prisma.kycDocument.findMany({
    include: {
      user: {
        include: {
          providerProfile: true,
          customerProfile: true,
        },
      },
    },
  });
};

// ✅ Get KYC Document by ID
export const getKycDocuments = async () => {
  return await prisma.kycDocument.findMany({
    include: { user: true },
  });
};

export const getKycDocumentById = async (id) => {
  return await prisma.kycDocument.findUnique({
    where: { id },
    include: { user: true },
  });
};

export const getKycDocumentByUserId = async (userId) => {
  return await prisma.kycDocument.findFirst({
    where: { userId },
    include: { user: true },
    orderBy: { uploadedAt: "desc" }, // ✅ ensures we get the newest one
  });
};


export const updateKycDocumentStatus = async (id, data) => {
  
  return await prisma.kycDocument.update({
    where: { id },
    data,
  });
};

export const updateAllKycDocumentsForUser = async (userId, data) => {
  return await prisma.kycDocument.updateMany({
    where: { userId },
    data,
  });
};

// Get reviewer names for given IDs
export const getReviewersByIds = async (ids = []) => {
  if (!ids.length) return [];
  return await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
};

// Update user verification status
export const updateUserVerificationStatus = async (userId, isVerified) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { isVerified },
  });
};

// Get user with KYC documents formatted for response
export const getUserWithKycDocuments = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      providerProfile: true,
      customerProfile: true,
      KycDocument: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!user) return null;

  // Format the response
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    kycStatus: user.kycStatus,
    isVerified: user.isVerified,
    providerProfile: user.providerProfile,
    customerProfile: user.customerProfile,
    kycDocuments: user.KycDocument.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      fileUrl: doc.fileUrl,
      filename: doc.filename,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
      reviewedAt: doc.reviewedAt,
      reviewNotes: doc.reviewNotes,
      reviewedBy: doc.reviewedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })),
  };
};