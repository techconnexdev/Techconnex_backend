// src/modules/certifications/certification.service.js
import {
  findProviderProfileByUser,
  createManyCertifications,
  findCertificationsByProfile,
  findCertificationById,
  deleteCertificationById,
} from "./model.js";

export const uploadCertifications = async (userId, certifications) => {
  const providerProfile = await findProviderProfileByUser(userId);
  if (!providerProfile) {
    throw new Error("Provider profile not found for this user.");
  }

  return createManyCertifications(providerProfile.id, certifications);
};

export const getCertificationsByUser = async (userId) => {
  const providerProfile = await findProviderProfileByUser(userId);
  if (!providerProfile) {
    throw new Error("Provider profile not found.");
  }

  return findCertificationsByProfile(providerProfile.id);
};

export const deleteCertification = async (certId, userId) => {
  const providerProfile = await findProviderProfileByUser(userId);
  if (!providerProfile) {
    throw new Error("Provider profile not found.");
  }

  const cert = await findCertificationById(certId);
  if (!cert || cert.profileId !== providerProfile.id) {
    throw new Error("Unauthorized or invalid certificate ID.");
  }

  await deleteCertificationById(certId);
  return { success: true };
};
