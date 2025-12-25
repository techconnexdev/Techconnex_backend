// controllers/payment.controller.js
import {
  initiateClientPayment,
  confirmPaymentSuccess,
  releasePaymentToProvider,
  confirmBankTransfer,
  refundPayment,
  getPendingPayouts,
  getProviderEarnings,
} from "./service.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
/**
 * POST /api/payments/initiate
 * Client initiates payment for a milestone
 */
export async function initiatePayment(req, res) {
  try {
    const { projectId, milestoneId: incomingMilestoneId, amount } = req.body;
    const customerId = req.user.id; // From auth middleware

    if (!projectId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Ensure milestone exists and is up-to-date. If milestone exists, update it.
    // If it doesn't, create a new milestone for the project and mark it LOCKED
    let milestoneId = incomingMilestoneId;

    // Find existing milestone if id provided
    if (milestoneId) {
      const existing = await prisma.milestone.findUnique({
        where: { id: milestoneId },
      });
      if (existing) {
        if (existing.projectId !== projectId) {
          return res
            .status(400)
            .json({
              success: false,
              message: "Milestone does not belong to the provided project",
            });
        }

        await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            amount: parseFloat(amount),
            status: "LOCKED",
          },
        });
      } else {
        // Create new milestone since provided id not found
        const maxOrder = await prisma.milestone.findFirst({
          where: { projectId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        const order = maxOrder ? (maxOrder.order || 0) + 1 : 1;
        const created = await prisma.milestone.create({
          data: {
            projectId,
            title: `Milestone ${order}`,
            description: "",
            amount: parseFloat(amount),
            dueDate: new Date(),
            order,
            status: "LOCKED",
            source: "AUTO",
          },
        });
        milestoneId = created.id;
      }
    } else {
      // No milestone id provided - create one
      const maxOrder = await prisma.milestone.findFirst({
        where: { projectId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const order = maxOrder ? (maxOrder.order || 0) + 1 : 1;
      const created = await prisma.milestone.create({
        data: {
          projectId,
          title: `Milestone ${order}`,
          description: "",
          amount: parseFloat(amount),
          dueDate: new Date(),
          order,
          status: "LOCKED",
          source: "AUTO",
        },
      });
      milestoneId = created.id;
    }

    const result = await initiateClientPayment({
      projectId,
      milestoneId,
      amount: parseFloat(amount),
      customerId,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Payment initiation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * POST /api/payments/release/:milestoneId
 * Admin/Customer releases payment after approving milestone
 */
export async function releasePayment(req, res) {
  try {
    const { milestoneId } = req.params;
    const approvedBy = req.user.id;

    const result = await releasePaymentToProvider(milestoneId, approvedBy);

    res.status(200).json({
      success: true,
      message: "Payment released for transfer",
      data: result,
    });
  } catch (error) {
    console.error("Payment release error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * POST /api/payments/confirm-transfer
 * Admin confirms bank transfer completed
 */
export async function confirmTransfer(req, res) {
  try {
    const { paymentId, transferReference } = req.body;
    const adminId = req.user.id;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!user.role.includes("ADMIN")) {
      return res.status(403).json({
        success: false,
        message: "Only admins can confirm bank transfers",
      });
    }

    const result = await confirmBankTransfer(
      paymentId,
      adminId,
      transferReference
    );

    res.status(200).json({
      success: true,
      message: "Bank transfer confirmed",
      data: result,
    });
  } catch (error) {
    console.error("Transfer confirmation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * POST /api/payments/refund
 * Refund a payment (for disputes/cancellations)
 */
export async function refundPaymentController(req, res) {
  try {
    const { paymentId, reason } = req.body;
    const refundedBy = req.user.id;

    if (!paymentId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Payment ID and reason are required",
      });
    }

    const result = await refundPayment(paymentId, reason, refundedBy);

    res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Refund error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /api/payments/pending-payouts
 * Admin gets list of payments pending bank transfer
 */
export async function getPendingPayoutsController(req, res) {
  try {
    const adminId = req.user.id;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!user.role.includes("ADMIN")) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view pending payouts",
      });
    }

    const payouts = await getPendingPayouts();

    res.status(200).json({
      success: true,
      data: payouts,
    });
  } catch (error) {
    console.error("Get payouts error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /api/payments/earnings
 * Provider gets their earnings summary
 */
export async function getEarningsController(req, res) {
  try {
    const providerId = req.user.id;

    const earnings = await getProviderEarnings(providerId);

    res.status(200).json({
      success: true,
      data: earnings,
    });
  } catch (error) {
    console.error("Get earnings error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * GET /api/payments/history
 * Get payment history for user
 */
export async function getPaymentHistory(req, res) {
  try {
    const userId = req.user.id;
    const { role } = req.query; // 'customer' or 'provider'

    const whereClause =
      role === "provider"
        ? { project: { providerId: userId } }
        : { project: { customerId: userId } };

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        milestone: {
          select: {
            title: true,
            description: true,
          },
        },
        project: {
          select: {
            title: true,
            customer: {
              select: {
                name: true,
                email: true,
              },
            },
            provider: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export default {
  initiatePayment,
  releasePayment,
  confirmTransfer,
  refundPaymentController,
  getPendingPayoutsController,
  getEarningsController,
  getPaymentHistory,
};
