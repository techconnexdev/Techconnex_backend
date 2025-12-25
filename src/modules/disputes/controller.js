import { disputeService } from "./service.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const disputeController = {
  async createDispute(req, res) {
    try {
      const userId = req.user.userId;
      
      // Handle file uploads - now expects R2 keys/URLs from frontend
      // Frontend sends: { attachments: [{ key, url }, ...] }
      let uploadedFiles = [];
      if (req.body.attachments && Array.isArray(req.body.attachments)) {
        uploadedFiles = req.body.attachments.map((att) => att.url || att.key);
      } else if (req.body.attachmentUrls && Array.isArray(req.body.attachmentUrls)) {
        // Backward compatibility: if frontend sends attachmentUrls directly
        uploadedFiles = req.body.attachmentUrls;
      }
      
      // Parse fields - now comes as JSON (not FormData)
      const { projectId, milestoneId, paymentId, reason, description, contestedAmount, suggestedResolution } = req.body;
      
      console.log("Dispute creation request:", {
        projectId,
        milestoneId,
        reason,
        description,
        contestedAmount,
        suggestedResolution,
        filesCount: uploadedFiles.length,
        bodyKeys: Object.keys(req.body || {}),
      });
      
      // Validate required fields
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: "Project ID is required",
        });
      }
      
      if (!reason || reason.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Reason is required",
        });
      }
      
      if (!description || description.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Description is required",
        });
      }

      // Get user name for attachment metadata
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const userName = user?.name || "Unknown User";
      const timestamp = new Date().toISOString();
      
      // Build description with attachment metadata if files are uploaded
      let finalDescription = description.trim();
      if (uploadedFiles.length > 0) {
        const attachmentMetadata = uploadedFiles.map(file => {
          // Extract filename from R2 key or URL
          const normalized = file.replace(/\\/g, "/");
          const filename = normalized.split('/').pop() || 'attachment';
          return `[Attachment: ${filename} uploaded by ${userName} on ${new Date(timestamp).toLocaleString()}]`;
        }).join('\n');
        finalDescription = `${finalDescription}\n\n${attachmentMetadata}`;
      }

      const dispute = await disputeService.createDispute({
        projectId: projectId.trim(),
        milestoneId: milestoneId && milestoneId !== "null" && milestoneId !== "undefined" && milestoneId.trim() !== "" ? milestoneId.trim() : null,
        paymentId: paymentId && paymentId !== "null" && paymentId !== "undefined" && paymentId.trim() !== "" ? paymentId.trim() : null,
        raisedById: userId,
        reason: reason.trim(),
        description: finalDescription,
        contestedAmount: contestedAmount && contestedAmount !== "" && contestedAmount !== "null" ? parseFloat(contestedAmount) : null,
        suggestedResolution: suggestedResolution && suggestedResolution.trim() !== "" ? suggestedResolution.trim() : null,
        attachments: uploadedFiles,
      });

      // Check if this was an update or creation
      const isUpdate = dispute.updatedAt !== dispute.createdAt;

      res.json({
        success: true,
        message: isUpdate ? "Dispute updated successfully" : "Dispute created successfully",
        data: dispute,
      });
    } catch (error) {
      console.error("Error creating/updating dispute:", error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getDisputeByProject(req, res) {
    try {
      const { projectId } = req.params;
      
      const dispute = await disputeService.getDisputeByProject(projectId);
      
      res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async updateDispute(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      
      // Handle file uploads - now expects R2 keys/URLs from frontend
      // Frontend sends: { attachments: [{ key, url }, ...] }
      let uploadedFiles = [];
      if (req.body.attachments && Array.isArray(req.body.attachments)) {
        uploadedFiles = req.body.attachments.map((att) => att.url || att.key);
      } else if (req.body.attachmentUrls && Array.isArray(req.body.attachmentUrls)) {
        // Backward compatibility: if frontend sends attachmentUrls directly
        uploadedFiles = req.body.attachmentUrls;
      }
      
      const { reason, description, contestedAmount, suggestedResolution, additionalNotes, projectId } = req.body;
      
      // Get existing dispute by ID
      const dispute = await disputeService.getDisputeById(id);
      
      if (!dispute) {
        return res.status(404).json({
          success: false,
          error: "Dispute not found",
        });
      }

      // Verify projectId matches if provided
      if (projectId && dispute.projectId !== projectId) {
        return res.status(400).json({
          success: false,
          error: "Dispute does not belong to this project",
        });
      }

      // Check if dispute is CLOSED or RESOLVED
      if (dispute.status === "CLOSED" || dispute.status === "RESOLVED") {
        return res.status(400).json({
          success: false,
          error: "Cannot update a closed or resolved dispute",
        });
      }

      const updateData = {};
      if (reason) updateData.reason = reason.trim();
      if (description) updateData.description = description.trim();
      if (contestedAmount) updateData.contestedAmount = parseFloat(contestedAmount);
      if (suggestedResolution) updateData.suggestedResolution = suggestedResolution.trim();
      if (additionalNotes) {
        // Get user name for the update
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        const userName = user?.name || "Unknown User";
        const timestamp = new Date().toISOString();
        
        // Append additional notes to description with name and timestamp
        updateData.description = `${dispute.description}\n\n---\n[Update by ${userName} on ${new Date(timestamp).toLocaleString()}]:\n${additionalNotes.trim()}`;
      }
      if (uploadedFiles.length > 0) {
        // Get user name for attachments
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        const userName = user?.name || "Unknown User";
        const timestamp = new Date().toISOString();
        
        // Store attachments with metadata in description
        const attachmentMetadata = uploadedFiles.map(file => {
          // Extract filename from R2 key or URL
          const normalized = file.replace(/\\/g, "/");
          const filename = normalized.split('/').pop() || 'attachment';
          return `[Attachment: ${filename} uploaded by ${userName} on ${new Date(timestamp).toLocaleString()}]`;
        }).join('\n');
        
        // Append attachment metadata to description
        if (updateData.description) {
          updateData.description = `${updateData.description}\n\n${attachmentMetadata}`;
        } else {
          updateData.description = `${dispute.description}\n\n${attachmentMetadata}`;
        }
        
        updateData.attachments = uploadedFiles;
      }

      const updatedDispute = await disputeService.updateDispute(id, updateData);

      res.json({
        success: true,
        message: "Dispute updated successfully",
        data: updatedDispute,
      });
    } catch (error) {
      console.error("Error updating dispute:", error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getDisputesByProject(req, res) {
    try {
      const { projectId } = req.params;
      
      const disputes = await disputeService.getDisputesByProject(projectId);
      
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
};

