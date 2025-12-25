import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export const createPaymentRecord = async ({ projectId, milestoneId, amount, currency }) => {
  return await prisma.payment.create({
    data: {
      projectId,
      milestoneId,
      amount,
      currency,
      status: "PENDING",
      method: "STRIPE",
    },
  });
};

export const updatePaymentStripeInfo = async (paymentId, { intentId, status }) => {
  return await prisma.payment.update({
    where: { id: paymentId },
    data: {
      stripePaymentIntentId: intentId,
      status,
    },
  });
};

export const finalizePaymentStatus = async (paymentId, success) => {
  return await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: success ? "ESCROWED" : "FAILED",
      updatedAt: new Date(),
    },
  });
};

export async function getReleasedPayments(providerId) {
  return await prisma.payment.findMany({
    where: {
      project: {
        providerId,
      },
      status: "RELEASED",
    },
  });
}

export async function markPaymentsInProgress(paymentIds) {
  return await prisma.payment.updateMany({
    where: { id: { in: paymentIds } },
    data: { status: "IN_PROGRESS" },
  });
}

export default prisma;
