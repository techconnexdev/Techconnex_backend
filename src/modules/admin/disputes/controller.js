import { disputeService } from "./service.js";

import { prisma } from "../../../utils/prisma.js";
export const disputeController = {
  async getAllDisputes(req, res) {
    try {
      const { status, search } = req.query;
      const filters = { status, search };
      
      const disputes = await disputeService.getAllDisputes(filters);
      
      res.json({
        success: true,
        data: disputes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getDisputeById(req, res) {
    try {
      const { id } = req.params;
      const dispute = await disputeService.getDisputeById(id);
      
      res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  },

  async resolveDispute(req, res) {
    try {
      const { id } = req.params;
      let { status, resolution } = req.body;
      const adminId = req.user?.userId || null;

      status = String(status || "").trim().toUpperCase();
      if (status === "CANCELLED") status = "REJECTED";
      
      // Get admin name from database
      let adminName = "Admin";
      if (adminId) {
        const { PrismaClient } = await import("@prisma/client");
const admin = await prisma.user.findUnique({
          where: { id: adminId },
          select: { name: true },
        });
        if (admin?.name) {
          adminName = admin.name;
        }
      }
      
      const dispute = await disputeService.resolveDispute(id, resolution, status, adminId, adminName);
      
      res.json({
        success: true,
        message: "Dispute resolved successfully",
        data: dispute,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async simulatePayout(req, res) {
    try {
      const { id } = req.params;
      // Handle both JSON and FormData - FormData values come as strings
      const refundAmount = req.body.refundAmount ? parseFloat(req.body.refundAmount) : 0;
      const releaseAmount = req.body.releaseAmount ? parseFloat(req.body.releaseAmount) : 0;
      const resolution = req.body.resolution || null;
      const adminId = req.user?.userId || null;
      
      // Get R2 URL if file was uploaded
      let bankTransferRefImageUrl = null;
      if (req.file && req.file.r2Url) {
        bankTransferRefImageUrl = req.file.r2Url;
      }
      
      // Get admin name from database
      let adminName = "Admin";
      if (adminId) {
        const { PrismaClient } = await import("@prisma/client");
const admin = await prisma.user.findUnique({
          where: { id: adminId },
          select: { name: true },
        });
        if (admin?.name) {
          adminName = admin.name;
        }
      }
      
      const payoutOverride =
        req.body.payoutBankName && req.body.payoutAccountNumber
          ? {
              bankName: String(req.body.payoutBankName).trim(),
              accountNumber: String(req.body.payoutAccountNumber).trim(),
              accountName: req.body.payoutAccountName
                ? String(req.body.payoutAccountName).trim()
                : "",
            }
          : null;

      const result = await disputeService.simulateDisputePayout(
        id,
        refundAmount,
        releaseAmount,
        resolution,
        adminId,
        adminName,
        bankTransferRefImageUrl,
        payoutOverride
      );
      
      res.json({
        success: true,
        message: "Dispute payout processed successfully",
        ...result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async manualResolveDispute(req, res) {
    try {
      const { id } = req.params;
      const { resolution, customerPayoutNote, providerPayoutNote } = req.body;
      const adminId = req.user?.userId || null;

      let adminName = "Admin";
      if (adminId) {
        const { PrismaClient } = await import("@prisma/client");
const admin = await prisma.user.findUnique({
          where: { id: adminId },
          select: { name: true },
        });
        if (admin?.name) adminName = admin.name;
      }

      const result = await disputeService.manualResolveDispute(id, {
        resolution,
        customerPayoutNote,
        providerPayoutNote,
        adminId,
        adminName,
      });

      res.json({
        success: true,
        message: "Dispute resolved (manual record — no Stripe action)",
        ...result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async redoMilestone(req, res) {
    try {
      const { id } = req.params;
      const { resolution } = req.body;
      const adminId = req.user?.userId || null;
      
      // Get admin name from database
      let adminName = "Admin";
      if (adminId) {
        const { PrismaClient } = await import("@prisma/client");
const admin = await prisma.user.findUnique({
          where: { id: adminId },
          select: { name: true },
        });
        if (admin?.name) {
          adminName = admin.name;
        }
      }
      
      const result = await disputeService.redoMilestone(id, resolution, adminId, adminName);
      
      res.json({
        success: true,
        message: "Milestone returned to IN_PROGRESS",
        ...result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async redoProject(req, res) {
    try {
      const { id } = req.params;
      const { resolution } = req.body;
      const adminId = req.user?.userId || null;

      let adminName = "Admin";
      if (adminId) {
        const { PrismaClient } = await import("@prisma/client");
const admin = await prisma.user.findUnique({
          where: { id: adminId },
          select: { name: true },
        });
        if (admin?.name) {
          adminName = admin.name;
        }
      }

      const result = await disputeService.redoProject(
        id,
        resolution,
        adminId,
        adminName,
      );

      res.json({
        success: true,
        message: "Dispute closed; project resumed. Parties may proceed normally.",
        ...result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getDisputeStats(req, res) {
    try {
      const stats = await disputeService.getDisputeStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

