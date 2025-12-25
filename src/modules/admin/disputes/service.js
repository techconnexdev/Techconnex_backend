import { disputeModel } from "./model.js";
import { refundPayment, releasePaymentForDispute } from "../../payment/service.js";

export const disputeService = {
  async getAllDisputes(filters = {}) {
    try {
      const disputes = await disputeModel.getAllDisputes(filters);
      return disputes;
    } catch (error) {
      throw new Error(`Failed to get disputes: ${error.message}`);
    }
  },

  async getDisputeById(disputeId) {
    try {
      const dispute = await disputeModel.getDisputeById(disputeId);
      if (!dispute) {
        throw new Error("Dispute not found");
      }
      return dispute;
    } catch (error) {
      throw new Error(`Failed to get dispute: ${error.message}`);
    }
  },

  async resolveDispute(disputeId, resolution, status, adminId = null, adminName = null) {
    try {
      const dispute = await disputeModel.getDisputeById(disputeId);
      if (!dispute) {
        throw new Error("Dispute not found");
      }

      const updatedDispute = await disputeModel.updateDisputeStatus(
        disputeId,
        status,
        resolution,
        adminId,
        adminName
      );

      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      // If resolving dispute, set project to DISPUTED and reject all milestones
      if (status === "RESOLVED") {
        // Set project status to DISPUTED
        await prisma.project.update({
          where: { id: dispute.projectId },
          data: {
            status: "DISPUTED",
          },
        });

        // Reject ALL milestones for this project
        await prisma.milestone.updateMany({
          where: { projectId: dispute.projectId },
          data: {
            status: "REJECTED",
          },
        });
      }

      // If closing dispute, freeze project work
      if (status === "CLOSED") {
        // Keep project status as DISPUTED to prevent further work
        await prisma.project.update({
          where: { id: dispute.projectId },
          data: {
            status: "DISPUTED",
          },
        });

        // If milestone exists, keep it as DISPUTED
        if (dispute.milestoneId) {
          await prisma.milestone.update({
            where: { id: dispute.milestoneId },
            data: {
              status: "DISPUTED",
            },
          });
        }
      }

      // If rejecting dispute, update milestone and project status
      if (status === "REJECTED" && dispute.milestoneId) {
        // Return milestone to previous status (or IN_PROGRESS)
        await prisma.milestone.update({
          where: { id: dispute.milestoneId },
          data: {
            status: "IN_PROGRESS",
          },
        });

        // Ensure payment remains in ESCROWED status (don't refund or release)
        if (dispute.paymentId) {
          const payment = await prisma.payment.findUnique({
            where: { id: dispute.paymentId },
          });

          if (payment && payment.status === "ESCROWED") {
            // Update payment metadata to track dispute rejection
            await prisma.payment.update({
              where: { id: dispute.paymentId },
              data: {
                metadata: {
                  ...payment.metadata,
                  disputeRejectedAt: new Date().toISOString(),
                  disputeRejectedBy: adminId || "admin",
                },
              },
            });
          }
        }

        // Update project status back to IN_PROGRESS if it was DISPUTED
        if (dispute.project?.status === "DISPUTED") {
          await prisma.project.update({
            where: { id: dispute.projectId },
            data: {
              status: "IN_PROGRESS",
            },
          });
        }
      }

      return updatedDispute;
    } catch (error) {
      throw new Error(`Failed to resolve dispute: ${error.message}`);
    }
  },

  async simulateDisputePayout(disputeId, refundAmount, releaseAmount, resolution = null, adminId = null, adminName = null, bankTransferRefImageUrl = null) {
    try {
      const dispute = await disputeModel.getDisputeById(disputeId);
      if (!dispute) {
        throw new Error("Dispute not found");
      }

      // Get the payment associated with this dispute
      let paymentId = dispute.paymentId;
      
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      
      // If paymentId is null, try to find payment by milestoneId
      if (!paymentId && dispute.milestoneId) {
        const paymentByMilestone = await prisma.payment.findFirst({
          where: {
            milestoneId: dispute.milestoneId,
            status: {
              in: ["ESCROWED", "RELEASED"],
            },
          },
          orderBy: {
            createdAt: "desc", // Get the most recent payment for this milestone
          },
        });
        
        if (paymentByMilestone) {
          paymentId = paymentByMilestone.id;
        }
      }
      
      if (!paymentId) {
        throw new Error("No payment associated with this dispute. Payment must be created before processing refunds or releases.");
      }

      // Get payment details
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          project: true,
          milestone: true,
        },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      // Validate payment status
      if (payment.status !== "ESCROWED") {
        throw new Error(`Cannot process payout for payment in ${payment.status} status. Payment must be ESCROWED.`);
      }

      const refundAmt = refundAmount || 0;
      const releaseAmt = releaseAmount || 0;
      const totalAmount = payment.amount;

      // Validate amounts
      if (refundAmt < 0 || releaseAmt < 0) {
        throw new Error("Refund and release amounts must be non-negative");
      }

      if (refundAmt + releaseAmt > totalAmount) {
        throw new Error(`Total refund (${refundAmt}) + release (${releaseAmt}) cannot exceed payment amount (${totalAmount})`);
      }

      const payoutResult = {
        disputeId,
        paymentId,
        refundAmount: refundAmt,
        releaseAmount: releaseAmt,
        timestamp: new Date().toISOString(),
        status: "processing",
      };

      // Process refund if needed
      if (refundAmt > 0) {
        try {
          const refundReason = `Dispute resolution: ${dispute.reason}`;
          const refundResult = await refundPayment(
            paymentId,
            refundReason,
            adminId || "admin",
            refundAmt < totalAmount ? refundAmt : null // Pass null for full refund
          );
          payoutResult.refundId = refundResult.refund.id;
          payoutResult.refundStatus = "completed";
          // Note: No bank transfer reference needed for refunds - processed directly via Stripe
        } catch (refundError) {
          console.error("Refund error:", refundError);
          throw new Error(`Failed to process refund: ${refundError.message}`);
        }
      }

      // Process release if needed (only if there's remaining amount after refund)
      if (releaseAmt > 0) {
        try {
          // Check if payment still exists and is in correct status
          const updatedPayment = await prisma.payment.findUnique({
            where: { id: paymentId },
          });

          if (!updatedPayment) {
            throw new Error("Payment not found after refund");
          }

          // If partial refund was done, we need to handle the release differently
          // For now, we'll release the specified amount
          // Note: In a real scenario with partial refunds, you might need to adjust the release amount
          if (updatedPayment.status === "ESCROWED") {
            // Calculate the actual amount to release
            // If we did a partial refund, the payment amount was reduced
            // So we need to release based on the remaining amount
            const actualReleaseAmount = refundAmt > 0 && refundAmt < totalAmount
              ? Math.min(releaseAmt, updatedPayment.amount)
              : releaseAmt;

            if (actualReleaseAmount > 0) {
              await releasePaymentForDispute(paymentId, adminId || "admin");
              payoutResult.releaseStatus = "completed";
              
              // Save bank transfer reference image URL to payment if provided (for release actions)
              if (bankTransferRefImageUrl) {
                await prisma.payment.update({
                  where: { id: paymentId },
                  data: {
                    bankTransferRef: bankTransferRefImageUrl,
                    metadata: {
                      ...updatedPayment.metadata,
                      bankTransferRefImageUploadedAt: new Date().toISOString(),
                      bankTransferRefImageUploadedBy: adminId || "admin",
                      bankTransferRefForRelease: true,
                    },
                  },
                });
              }
            }
          } else if (updatedPayment.status === "RELEASED") {
            // Payment already released (might have been released before)
            payoutResult.releaseStatus = "already_released";
          } else {
            throw new Error(`Cannot release payment in ${updatedPayment.status} status`);
          }
        } catch (releaseError) {
          console.error("Release error:", releaseError);
          // Don't throw here - refund might have succeeded, so we should still resolve the dispute
          payoutResult.releaseStatus = "failed";
          payoutResult.releaseError = releaseError.message;
        }
      }

      payoutResult.status = "completed";

      // Build auto-generated resolution note based on payout amounts
      let autoResolutionNote = "";
      if (refundAmt > 0 && releaseAmt > 0) {
        autoResolutionNote = `Partial Split: Refunded RM${refundAmt} to customer, Released RM${releaseAmt} to provider.`;
      } else if (refundAmt > 0) {
        autoResolutionNote = `Full Refund: RM${refundAmt} refunded to customer.`;
      } else if (releaseAmt > 0) {
        autoResolutionNote = `Full Release: RM${releaseAmt} released to provider.`;
      } else {
        autoResolutionNote = "Dispute resolved with no payment changes.";
      }
      
      // Combine auto-generated note and admin's custom note into one resolution note
      let combinedResolutionNote = autoResolutionNote;
      if (resolution && resolution.trim()) {
        combinedResolutionNote = `${autoResolutionNote}\n\n--- Admin Note ---\n${resolution.trim()}`;
      }
      
      // Update dispute status to RESOLVED with combined note
      const updatedDispute = await disputeModel.updateDisputeStatus(
        disputeId,
        "RESOLVED",
        combinedResolutionNote,
        adminId,
        adminName
      );

      // When dispute is RESOLVED, set project to DISPUTED and reject ALL milestones
      await prisma.project.update({
        where: { id: dispute.projectId },
        data: {
          status: "DISPUTED",
        },
      });

      // Reject ALL milestones for this project
      await prisma.milestone.updateMany({
        where: { projectId: dispute.projectId },
        data: {
          status: "REJECTED",
        },
      });

      return {
        success: true,
        payout: payoutResult,
        dispute: updatedDispute,
      };
    } catch (error) {
      throw new Error(`Failed to process dispute payout: ${error.message}`);
    }
  },

  async redoMilestone(disputeId, resolution = null, adminId = null, adminName = null) {
    try {
      const dispute = await disputeModel.getDisputeById(disputeId);
      if (!dispute) {
        throw new Error("Dispute not found");
      }

      // Check for milestoneId directly or through payment
      const milestoneId = dispute.milestoneId || dispute.payment?.milestoneId;
      
      if (!milestoneId) {
        throw new Error("No milestone associated with this dispute");
      }

      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      // Update milestone status to IN_PROGRESS (mark as "Disputed — Needs Update")
      const updatedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          status: "IN_PROGRESS",
        },
      });

      // Ensure payment remains in ESCROWED status (don't refund or release)
      if (dispute.paymentId) {
        const payment = await prisma.payment.findUnique({
          where: { id: dispute.paymentId },
        });

        if (payment && payment.status === "ESCROWED") {
          // Update payment metadata to track dispute redo
          await prisma.payment.update({
            where: { id: dispute.paymentId },
            data: {
              metadata: {
                ...payment.metadata,
                disputeRedoAt: new Date().toISOString(),
                disputeRedoBy: adminId || "admin",
              },
            },
          });
        }
      }

      // Update project status back to IN_PROGRESS if it was DISPUTED
      if (dispute.project?.status === "DISPUTED") {
        await prisma.project.update({
          where: { id: dispute.projectId },
          data: {
            status: "IN_PROGRESS",
          },
        });
      }

      // Build auto-generated resolution note
      const autoResolutionNote = "Milestone returned to IN_PROGRESS for resubmission. Provider can now edit and resubmit. Payment remains in escrow.";
      
      // Combine auto-generated note and admin's custom note into one resolution note
      let combinedResolutionNote = autoResolutionNote;
      if (resolution && resolution.trim()) {
        combinedResolutionNote = `${autoResolutionNote}\n\n--- Admin Note ---\n${resolution.trim()}`;
      }
      
      // Update dispute status to UNDER_REVIEW with combined note
      const updatedDispute = await disputeModel.updateDisputeStatus(
        disputeId,
        "UNDER_REVIEW",
        combinedResolutionNote,
        adminId,
        adminName
      );

      return {
        success: true,
        milestone: updatedMilestone,
        dispute: updatedDispute,
      };
    } catch (error) {
      throw new Error(`Failed to redo milestone: ${error.message}`);
    }
  },

  async getDisputeStats() {
    try {
      const stats = await disputeModel.getDisputeStats();
      return stats;
    } catch (error) {
      throw new Error(`Failed to get dispute stats: ${error.message}`);
    }
  },
};

