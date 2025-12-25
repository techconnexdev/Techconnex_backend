// controllers/webhook.controller.js
import Stripe from "stripe";
import { confirmPaymentSuccess } from "./service.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received webhook event: ${event.type}`);

  // Handle the event
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object);
        break;

      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log("Payment succeeded:", paymentIntent.id);

  try {
    await confirmPaymentSuccess(paymentIntent.id);
    console.log("Payment moved to ESCROWED status");
  } catch (error) {
    console.error("Error handling payment success:", error);

    // Log error to database for tracking
    try {
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: paymentIntent.id },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            metadata: {
              ...payment.metadata,
              webhookError: error.message,
              webhookErrorAt: new Date().toISOString(),
            },
          },
        });
      }
    } catch (logError) {
      console.error("Failed to log webhook error:", logError);
    }

    // Re-throw to be caught by main handler
    throw error;
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent) {
  console.log("Payment failed:", paymentIntent.id);

  try {
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          metadata: {
            ...payment.metadata,
            failureReason: paymentIntent.last_payment_error?.message,
            failedAt: new Date().toISOString(),
          },
        },
      });

      // Notify customer
      await prisma.notification.create({
        data: {
          userId: payment.project.customerId,
          type: "PAYMENT_FAILED",
          title: "Payment Failed",
          content: `Your payment failed. Please try again.`,
          metadata: {
            paymentId: payment.id,
            reason: paymentIntent.last_payment_error?.message,
          },
        },
      });
    }
  } catch (error) {
    console.error("Error handling payment failure:", error);
  }
}

/**
 * Handle refund completion
 */
async function handleChargeRefunded(charge) {
  console.log("Charge refunded:", charge.id);

  try {
    const payment = await prisma.payment.findFirst({
      where: { stripeChargeId: charge.id },
      include: {
        project: true,
      },
    });

    if (payment && payment.status !== "REFUNDED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "REFUNDED",
          metadata: {
            ...payment.metadata,
            refundedAt: new Date().toISOString(),
            refundAmount: charge.amount_refunded / 100,
          },
        },
      });

      // Notify customer
      await prisma.notification.create({
        data: {
          userId: payment.project.customerId,
          type: "REFUND_COMPLETED",
          title: "Refund Processed",
          content: `Your refund of MYR ${
            charge.amount_refunded / 100
          } has been processed.`,
          metadata: {
            paymentId: payment.id,
            refundAmount: charge.amount_refunded / 100,
          },
        },
      });
    }
  } catch (error) {
    console.error("Error handling refund:", error);
  }
}

/**
 * Handle dispute created
 */
async function handleDisputeCreated(dispute) {
  console.log("Dispute created:", dispute.id);

  try {
    const payment = await prisma.payment.findFirst({
      where: { stripeChargeId: dispute.charge },
      include: {
        project: true,
        milestone: true,
      },
    });

    if (payment) {
      // Create dispute record
      await prisma.dispute.create({
        data: {
          projectId: payment.projectId,
          milestoneId: payment.milestoneId,
          paymentId: payment.id,
          raisedBy: payment.project.customerId, // Disputes usually raised by customer
          reason: dispute.reason,
          description: `Stripe dispute: ${dispute.reason}`,
          status: "OPEN",
          metadata: {
            stripeDisputeId: dispute.id,
            amount: dispute.amount / 100,
            evidence_due_by: dispute.evidence_details.due_by,
          },
        },
      });

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "DISPUTED",
          metadata: {
            ...payment.metadata,
            disputeId: dispute.id,
            disputedAt: new Date().toISOString(),
          },
        },
      });

      // Update milestone status
      await prisma.milestone.update({
        where: { id: payment.milestoneId },
        data: {
          status: "DISPUTED",
        },
      });

      // Notify both parties
      await prisma.notification.createMany({
        data: [
          {
            userId: payment.project.customerId,
            type: "DISPUTE_CREATED",
            title: "Dispute Created",
            message: `A dispute has been created for your payment.`,
            metadata: { paymentId: payment.id, disputeId: dispute.id },
          },
          {
            userId: payment.project.providerId,
            type: "DISPUTE_CREATED",
            title: "Payment Disputed",
            message: `The client has disputed the payment for ${payment.milestone.title}.`,
            metadata: { paymentId: payment.id, disputeId: dispute.id },
          },
        ],
      });
    }
  } catch (error) {
    console.error("Error handling dispute creation:", error);
  }
}

/**
 * Handle dispute closed
 */
async function handleDisputeClosed(dispute) {
  console.log("Dispute closed:", dispute.id);

  try {
    const disputeRecord = await prisma.dispute.findFirst({
      where: {
        metadata: {
          path: ["stripeDisputeId"],
          equals: dispute.id,
        },
      },
      include: {
        payment: {
          include: {
            project: true,
          },
        },
      },
    });

    if (disputeRecord) {
      const won = dispute.status === "won";

      await prisma.dispute.update({
        where: { id: disputeRecord.id },
        data: {
          status: won ? "RESOLVED_FOR_PROVIDER" : "RESOLVED_FOR_CUSTOMER",
          resolution: dispute.status,
          resolvedAt: new Date(),
        },
      });

      // Update payment based on outcome
      const newPaymentStatus = won ? "ESCROWED" : "REFUNDED";
      await prisma.payment.update({
        where: { id: disputeRecord.paymentId },
        data: {
          status: newPaymentStatus,
          metadata: {
            ...disputeRecord.payment.metadata,
            disputeResolution: dispute.status,
            disputeResolvedAt: new Date().toISOString(),
          },
        },
      });

      // Notify both parties
      const message = won
        ? "The dispute has been resolved in favor of the provider."
        : "The dispute has been resolved in favor of the customer.";

      await prisma.notification.createMany({
        data: [
          {
            userId: disputeRecord.payment.project.customerId,
            type: "DISPUTE_RESOLVED",
            title: "Dispute Resolved",
            message,
            metadata: { disputeId: disputeRecord.id, outcome: dispute.status },
          },
          {
            userId: disputeRecord.payment.project.providerId,
            type: "DISPUTE_RESOLVED",
            title: "Dispute Resolved",
            message,
            metadata: { disputeId: disputeRecord.id, outcome: dispute.status },
          },
        ],
      });
    }
  } catch (error) {
    console.error("Error handling dispute closure:", error);
  }
}

export default { handleStripeWebhook };
