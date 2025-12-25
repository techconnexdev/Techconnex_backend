// src/modules/company/reviews/index.js
import express from "express";
import {
  createReviewController,
  getReviewsController,
  getReviewController,
  updateReviewController,
  deleteReviewController,
  createReviewReplyController,
  updateReviewReplyController,
  getCompletedProjectsController,
  getReviewStatisticsController,
} from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.post("/", createReviewController);
router.get("/", getReviewsController);
router.get("/statistics", getReviewStatisticsController);
router.get("/projects/completed", getCompletedProjectsController);
router.get("/:id", getReviewController);
router.put("/:id", updateReviewController);
router.delete("/:id", deleteReviewController);
router.post("/:id/reply", createReviewReplyController);
router.put("/reply/:replyId", updateReviewReplyController);

export default router;
