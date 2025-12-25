// src/modules/provider/send-proposal/controller.js
import {
  sendProposal,
  getProposals,
  getProposalById,
  updateProposal,
  deleteProposal,
  getProposalMilestones,
  updateProposalMilestones,
} from "./service.js";
import { SendProposalDto, GetProposalsDto } from "./dto.js";

// POST /api/provider/proposals - Send a proposal (now accepts R2 keys/URLs)
export async function sendProposalController(req, res) {
  try {
    // Extract attachment URLs from request body (sent from frontend after R2 upload)
    // Frontend sends: { attachments: [{ key, url }, ...] }
    let attachmentUrls = [];
    if (req.body.attachments && Array.isArray(req.body.attachments)) {
      attachmentUrls = req.body.attachments.map((att) => att.url || att.key);
    } else if (req.body.attachmentUrls && Array.isArray(req.body.attachmentUrls)) {
      // Backward compatibility: if frontend sends attachmentUrls directly
      attachmentUrls = req.body.attachmentUrls;
    }

    const dto = new SendProposalDto({
      ...req.body,
      providerId: req.user.userId, // User ID from JWT payload
      attachmentUrls: attachmentUrls,
    });
    dto.validate();

    const proposal = await sendProposal(dto);

    res.status(201).json({
      success: true,
      message: "Proposal sent successfully",
      proposal,
    });
  } catch (error) {
    console.error("Error in sendProposalController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/proposals - Get all proposals by provider
export async function getProposalsController(req, res) {
  try {
    const dto = new GetProposalsDto({
      providerId: req.user.userId, // User ID from JWT payload
      ...req.query,
    });
    dto.validate();

    const result = await getProposals(dto);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getProposalsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/proposals/:id - Get a specific proposal
export async function getProposalController(req, res) {
  try {
    const proposalId = req.params.id;
    const providerId = req.user.userId; // User ID from JWT payload

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        message: "Proposal ID is required",
      });
    }

    const proposal = await getProposalById(proposalId, providerId);

    res.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error("Error in getProposalController:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// PUT /api/provider/proposals/:id - Update a proposal
export async function updateProposalController(req, res) {
  try {
    const proposalId = req.params.id;
    const providerId = req.user.userId; // User ID from JWT payload
    const updateData = req.body;

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        message: "Proposal ID is required",
      });
    }

    const proposal = await updateProposal(proposalId, providerId, updateData);

    res.json({
      success: true,
      message: "Proposal updated successfully",
      proposal,
    });
  } catch (error) {
    console.error("Error in updateProposalController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// DELETE /api/provider/proposals/:id - Delete a proposal
export async function deleteProposalController(req, res) {
  try {
    const proposalId = req.params.id;
    const providerId = req.user.userId; // User ID from JWT payload

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        message: "Proposal ID is required",
      });
    }

    const result = await deleteProposal(proposalId, providerId);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in deleteProposalController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/proposals/:id/milestones - Get proposal milestones
export async function getProposalMilestonesController(req, res) {
  try {
    const proposalId = req.params.id;
    const providerId = req.user.userId;

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        message: "Proposal ID is required",
      });
    }

    const milestones = await getProposalMilestones(proposalId, providerId);

    res.json({
      success: true,
      milestones,
    });
  } catch (error) {
    console.error("Error in getProposalMilestonesController:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// POST /api/provider/proposals/:id/milestones - Update proposal milestones
export async function updateProposalMilestonesController(req, res) {
  try {
    const proposalId = req.params.id;
    const providerId = req.user.userId;
    const { milestones } = req.body;

    if (!proposalId) {
      return res.status(400).json({
        success: false,
        message: "Proposal ID is required",
      });
    }

    if (!milestones || !Array.isArray(milestones)) {
      return res.status(400).json({
        success: false,
        message: "Milestones array is required",
      });
    }

    // Validate milestone structure
    for (const milestone of milestones) {
      if (!milestone.title || !milestone.amount) {
        return res.status(400).json({
          success: false,
          message: "Each milestone must have title and amount",
        });
      }
    }

    const updatedMilestones = await updateProposalMilestones(proposalId, providerId, milestones);

    res.json({
      success: true,
      message: "Proposal milestones updated successfully",
      milestones: updatedMilestones,
    });
  } catch (error) {
    console.error("Error in updateProposalMilestonesController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}