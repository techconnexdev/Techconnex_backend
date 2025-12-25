// src/modules/provider/projects/controller.js
import {
  getProviderProjects,
  getProviderProjectById,
  updateProjectStatus,
  updateMilestoneStatus,
  getProviderProjectStats,
  getProviderPerformanceMetrics,
} from "./service.js";
import { GetProviderProjectsDto, UpdateProjectStatusDto, UpdateMilestoneStatusDto } from "./dto.js";
import { generateProviderProjectsPDF } from "../../../utils/projectsPdfGenerator.js";

// GET /api/provider/projects - Get all projects for a provider
export async function getProjectsController(req, res) {
  try {
    const dto = new GetProviderProjectsDto({
      ...req.query,
      providerId: req.user.userId, // User ID from JWT payload
    });
    dto.validate();

    const result = await getProviderProjects(dto);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getProjectsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/projects/:id - Get a single project
export async function getProjectController(req, res) {
  try {
    const projectId = req.params.id;
    const providerId = req.user.userId;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    const project = await getProviderProjectById(projectId, providerId);

    res.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Error in getProjectController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// PUT /api/provider/projects/:id/status - Update project status
export async function updateProjectStatusController(req, res) {
  try {
    const projectId = req.params.id;
    const providerId = req.user.userId;
    const { status } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    const dto = new UpdateProjectStatusDto({
      projectId,
      providerId,
      status,
    });
    dto.validate();

    const project = await updateProjectStatus(dto);

    res.json({
      success: true,
      message: "Project status updated successfully",
      project,
    });
  } catch (error) {
    console.error("Error in updateProjectStatusController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// PUT /api/provider/projects/milestones/:id/status - Update milestone status
export async function updateMilestoneStatusController(req, res) {
  try {
    const milestoneId = req.params.id;
    const providerId = req.user.userId;
    let { status, deliverables, submissionNote } = req.body;
    
    // Parse deliverables if it's a string (from FormData)
    if (typeof deliverables === 'string') {
      try {
        deliverables = JSON.parse(deliverables);
      } catch (e) {
        // If parsing fails, treat as plain string or object
        deliverables = deliverables;
      }
    }

    // Handle file upload - now accepts R2 key/URL from request body
    let submissionAttachmentUrl = null;
    if (req.body.submissionAttachmentUrl) {
      // Frontend sends the R2 URL/key after uploading
      submissionAttachmentUrl = req.body.submissionAttachmentUrl;
    } else if (req.body.attachment && req.body.attachment.url) {
      // Alternative format: { attachment: { key, url } }
      submissionAttachmentUrl = req.body.attachment.url || req.body.attachment.key;
    }

    if (!milestoneId) {
      return res.status(400).json({
        success: false,
        message: "Milestone ID is required",
      });
    }

    const dto = new UpdateMilestoneStatusDto({
      milestoneId,
      providerId,
      status,
      deliverables,
      submissionNote,
      submissionAttachmentUrl,
    });
    dto.validate();

    const milestone = await updateMilestoneStatus(dto);

    res.json({
      success: true,
      message: "Milestone status updated successfully",
      milestone,
    });
  } catch (error) {
    console.error("Error in updateMilestoneStatusController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/projects/stats - Get project statistics
export async function getProjectStatsController(req, res) {
  try {
    const providerId = req.user.userId;

    const stats = await getProviderProjectStats(providerId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error in getProjectStatsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/projects/performance - Get performance metrics
export async function getPerformanceMetricsController(req, res) {
  try {
    const providerId = req.user.userId;

    const metrics = await getProviderPerformanceMetrics(providerId);

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("Error in getPerformanceMetricsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/projects/export - Export projects as PDF
export async function exportProjectsController(req, res) {
  try {
    // Fetch all projects in batches to respect DTO validation (limit max 100)
    const allProjects = [];
    let page = 1;
    const limit = 100; // Max allowed by DTO
    let hasMore = true;

    while (hasMore) {
      const dto = new GetProviderProjectsDto({
        ...req.query,
        providerId: req.user.userId,
        page: page,
        limit: limit,
      });
      dto.validate();

      const result = await getProviderProjects(dto);
      const items = Array.isArray(result.projects) ? result.projects : [];
      allProjects.push(...items);

      // Check if there are more pages
      const total = result.pagination?.total || 0;
      const totalPages = result.pagination?.totalPages || 1;
      hasMore = page < totalPages;
      page++;
    }

    // Generate PDF
    const pdfBuffer = await generateProviderProjectsPDF(allProjects, {
      search: req.query.search,
      status: req.query.status,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="provider-projects-${Date.now()}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error in exportProjectsController:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
