// src/modules/provider/milestones/model.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const findProviderProfileByUser = async (userId) => {
  return prisma.providerProfile.findUnique({
    where: { userId },
  });
};

export const createManyCertifications = async (profileId, certifications) => {
  return prisma.certification.createMany({
    data: certifications.map((cert) => ({
      profileId,
      name: cert.name,
      issuer: cert.issuer,
      issuedDate: new Date(cert.issuedDate),
      verified: cert.verified ?? false,
      serialNumber: cert.serialNumber || null,
      sourceUrl: cert.sourceUrl || null,
    })),
  });
};

export const findCertificationsByProfile = async (profileId) => {
  return prisma.certification.findMany({
    where: { profileId },
    orderBy: { issuedDate: "desc" },
  });
};

export const findCertificationById = async (id) => {
  return prisma.certification.findUnique({
    where: { id },
  });
};

export const deleteCertificationById = async (id) => {
  return prisma.certification.delete({
    where: { id },
  });
};
