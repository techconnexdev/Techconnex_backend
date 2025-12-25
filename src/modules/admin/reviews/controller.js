// src/modules/admin/reviews/controller.js
import {
  getAllReviews,
  getReviewsByType,
  getReviewStatistics,
  deleteReview,
} from "./service.js";

// Get all reviews
export async function getAllReviewsController(req, res) {
  try {
    const { type } = req.query;

    let reviews;
    if (type && (type === "company" || type === "provider")) {
      reviews = await getReviewsByType(type);
    } else {
      reviews = await getAllReviews();
    }

    res.json({
      success: true,
      reviews,
    });
  } catch (error) {
    console.error("Error in getAllReviewsController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
}

// Get review statistics
export async function getReviewStatisticsController(req, res) {
  try {
    const stats = await getReviewStatistics();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error in getReviewStatisticsController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch review statistics",
      error: error.message,
    });
  }
}

// Delete a review
export async function deleteReviewController(req, res) {
  try {
    const { reviewId } = req.params;

    await deleteReview(reviewId);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteReviewController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message,
    });
  }
}

