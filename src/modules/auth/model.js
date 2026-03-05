// src/modules/company/auth/model.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

export { findUserByEmail, findUserById, findProviderProfile, updateUserPassword };
