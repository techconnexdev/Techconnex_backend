import { prisma } from "../../utils/prisma.js";
// /models/settings.model.js
// 🔹 Get all settings for a user
export const findSettingsByUserId = async (userId) => {
  return await prisma.settings.findUnique({
    where: { userId },
    include: { payments: true },
  });
};

// 🔹 Get payment history for a user's settings
export const findPaymentsByUserId = async (userId) => {
  return await prisma.payment.findMany({
    where: {
      Settings: {
        some: { userId },
      },
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      method: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export default prisma;
