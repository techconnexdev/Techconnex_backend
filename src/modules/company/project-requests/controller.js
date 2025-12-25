// src/modules/company/project-requests/controller.js
import {
  getProjectRequests,
  getProjectRequestById,
  acceptProposal,
  rejectProposal,
  getProposalStats,
} from "./service.js";
import { GetProjectRequestsDto, AcceptProposalDto, RejectProposalDto } from "./dto.js";
import { generateCustomerRequestsPDF } from "../../../utils/projectsPdfGenerator.js";

// GET /api/company/project-requests - Get all project requests (proposals) for a company
export async function getProjectRequestsController(req, res) {
  try {
    const dto = new GetProjectRequestsDto({
      customerId: req.user.userId, // User ID from JWT payload
      ...req.query,
    });
    dto.validate();

    const result = await getProjectRequests(dto);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getProjectRequestsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/company/project-requests/:id - Get a specific project request (proposal)
export async function getProjectRequestController(req, res) {
  try {
    const requestId = req.params.id;
    const customerId = req.user.userId; // User ID from JWT payload

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Request ID is required",
      });
    }

    const proposal = await getProjectRequestById(requestId, customerId);

    res.json({
      success: true,
      proposal,
    });
  } catch (error) {
    console.error("Error in getProjectRequestController:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// POST /api/company/project-requests/:id/accept - Accept a proposal
export async function acceptProposalController(req, res) {
  try {
    const dto = new AcceptProposalDto({
      proposalId: req.params.id,
      customerId: req.user.userId, // Assuming user ID comes from auth middleware
      useProviderMilestones: req.body.useProviderMilestones,
    });
    dto.validate();

    const project = await acceptProposal(dto);

    res.json({
      success: true,
      message: "Proposal accepted successfully. Project created.",
      project,
    });
  } catch (error) {
    console.error("Error in acceptProposalController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// POST /api/company/project-requests/:id/reject - Reject a proposal
export async function rejectProposalController(req, res) {
  try {
    const dto = new RejectProposalDto({
      proposalId: req.params.id,
      customerId: req.user.userId, // Assuming user ID comes from auth middleware
      reason: req.body.reason,
    });
    dto.validate();

    const result = await rejectProposal(dto);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in rejectProposalController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/company/project-requests/stats - Get proposal statistics
export async function getProposalStatsController(req, res) {
  try {
    const customerId = req.user.userId; // User ID from JWT payload

    const stats = await getProposalStats(customerId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error in getProposalStatsController:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/company/project-requests/export - Export requests as PDF
export async function exportRequestsController(req, res) {
  try {
    const dto = new GetProjectRequestsDto({
      customerId: req.user.userId,
      ...req.query,
      page: 1,
      limit: 1000, // Get all requests for export
    });
    dto.validate();

    const result = await getProjectRequests(dto);
    const proposals = result.proposals || [];

    // Transform proposals to match frontend format
    const requests = proposals.map((proposal) => {
      const provider = proposal.provider || {};
      const profile = provider.providerProfile || {};
      return {
        id: proposal.id,
        providerName: provider.name || "N/A",
        projectTitle: proposal.serviceRequest?.title || "N/A",
        bidAmount: proposal.bidAmount || 0,
        status: proposal.status || "PENDING",
        providerRating: parseFloat(profile.rating || 0),
        submittedAt: proposal.createdAt,
        milestones: proposal.milestones || [],
      };
    });

    // Generate PDF
    const pdfBuffer = await generateCustomerRequestsPDF(requests, {
      search: req.query.search,
      status: req.query.proposalStatus,
      project: req.query.serviceRequestId,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="provider-requests-${Date.now()}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error in exportRequestsController:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}