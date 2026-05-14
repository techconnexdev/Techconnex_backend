import { prisma } from "../../utils/prisma.js";
// src/modules/company/auth/model.js
// User queries
async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      settings: true, // ✅ lowercase 'settings'
    },
  });
}

async function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

/** Match stored phone whether saved with or without leading + */
async function findUserByPhoneVariants(e164) {
  const withPlus = String(e164).trim().startsWith("+")
    ? String(e164).trim()
    : `+${String(e164).replace(/\D/g, "")}`;
  const noPlus = withPlus.replace(/^\+/, "");
  const variants = [...new Set([withPlus, noPlus])];
  return prisma.user.findFirst({
    where: { OR: variants.map((phone) => ({ phone })) },
    include: {
      settings: true,
    },
  });
}

// Provider profile queries
async function findProviderProfile(userId) {
  return prisma.providerProfile.findUnique({ where: { userId } });
}

async function updateUserPassword(userId, hashedPassword) {
  return prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
}

export {
  findUserByEmail,
  findUserById,
  findUserByPhoneVariants,
  findProviderProfile,
  updateUserPassword,
};
