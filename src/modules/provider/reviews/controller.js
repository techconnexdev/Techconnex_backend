// src/modules/provider/reviews/controller.js
import {
  createReview,
  getReviews,
  getReviewById,
  updateReview,
  deleteReview,
  createReviewReply,
  updateReviewReply,
  getCompletedProjectsForReview,
  getReviewStatistics
} from "./service.js";
import {
  CreateReviewDto,
  GetReviewsDto,
  UpdateReviewDto,
  CreateReviewReplyDto
} from "./dto.js";

// POST /api/provider/reviews - Create a new review
export async function createReviewController(req, res) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }

    const dto = new CreateReviewDto({
      ...req.body,
      reviewerId: req.user.userId, // Provider ID from JWT payload
    });
    dto.validate();

    const review = await createReview(dto);

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      review,
    });
  } catch (error) {
    console.error("❌ Error in createReviewController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/reviews - Get reviews for a provider
export async function getReviewsController(req, res) {
  try {
    const dto = new GetReviewsDto({
      ...req.query,
      providerId: req.user.userId, // Provider ID from JWT payload
    });
    dto.validate();

    const result = await getReviews(dto);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getReviewsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/reviews/:id - Get review by ID
export async function getReviewController(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Review ID is required",
      });
    }

    const review = await getReviewById(id, userId);

    res.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("Error in getReviewController:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// PUT /api/provider/reviews/:id - Update review
export async function updateReviewController(req, res) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }

    const dto = new UpdateReviewDto({
      ...req.body,
      reviewId: req.params.id,
      providerId: req.user.userId, // Provider ID from JWT payload
    });
    dto.validate();

    const review = await updateReview(dto);

    res.json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (error) {
    console.error("Error in updateReviewController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// DELETE /api/provider/reviews/:id - Delete review
export async function deleteReviewController(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Review ID is required",
      });
    }

    const result = await deleteReview(id, userId);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in deleteReviewController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// POST /api/provider/reviews/:id/reply - Create review reply
export async function createReviewReplyController(req, res) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }

    const dto = new CreateReviewReplyDto({
      ...req.body,
      reviewId: req.params.id,
      userId: req.user.userId, // User ID from JWT payload
    });
    dto.validate();

    const reply = await createReviewReply(dto);

    res.status(201).json({
      success: true,
      message: "Reply created successfully",
      reply,
    });
  } catch (error) {
    console.error("Error in createReviewReplyController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// PUT /api/provider/reviews/reply/:replyId - Update review reply
export async function updateReviewReplyController(req, res) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }

    const { replyId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!replyId) {
      return res.status(400).json({
        success: false,
        message: "Reply ID is required",
      });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Reply content is required",
      });
    }

    const reply = await updateReviewReply(replyId, content, userId);

    res.json({
      success: true,
      message: "Reply updated successfully",
      reply,
    });
  } catch (error) {
    console.error("Error in updateReviewReplyController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/reviews/projects/completed - Get completed projects for review
export async function getCompletedProjectsController(req, res) {
  try {
    const providerId = req.user.userId;

    const projects = await getCompletedProjectsForReview(providerId);

    res.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Error in getCompletedProjectsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/reviews/statistics - Get review statistics
export async function getReviewStatisticsController(req, res) {
  try {
    const providerId = req.user.userId;

    const statistics = await getReviewStatistics(providerId);

    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    console.error("Error in getReviewStatisticsController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
