// src/modules/admin/reviews/service.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get all reviews (both company and provider reviews)
export async function getAllReviews() {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        ReviewReply: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                id: true,
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

    return reviews;
  } catch (error) {
    console.error("Error in getAllReviews:", error);
    throw error;
  }
}

// Get reviews by type (company or provider)
export async function getReviewsByType(type) {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        reviewer: {
          role: {
            has: type === "company" ? "CUSTOMER" : "PROVIDER",
          },
        },
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        ReviewReply: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                id: true,
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

    return reviews;
  } catch (error) {
    console.error("Error in getReviewsByType:", error);
    throw error;
  }
}

// Get review statistics
export async function getReviewStatistics() {
  try {
    const totalReviews = await prisma.review.count();

    const averageRating = await prisma.review.aggregate({
      _avg: {
        rating: true,
      },
    });

    const companyReviews = await prisma.review.count({
      where: {
        reviewer: {
          role: {
            has: "CUSTOMER",
          },
        },
      },
    });

    const providerReviews = await prisma.review.count({
      where: {
        reviewer: {
          role: {
            has: "PROVIDER",
          },
        },
      },
    });

    const ratingDistribution = await prisma.review.groupBy({
      by: ["rating"],
      _count: {
        rating: true,
      },
    });

    return {
      totalReviews,
      averageRating: averageRating._avg.rating || 0,
      companyReviews,
      providerReviews,
      ratingDistribution,
    };
  } catch (error) {
    console.error("Error in getReviewStatistics:", error);
    throw error;
  }
}

// Delete a review (admin only)
export async function deleteReview(reviewId) {
  try {
    // Delete review and related replies in a transaction
    await prisma.$transaction([
      prisma.reviewReply.deleteMany({
        where: { reviewId },
      }),
      prisma.review.delete({
        where: { id: reviewId },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Error in deleteReview:", error);
    throw error;
  }
}

