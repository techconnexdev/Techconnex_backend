// src/modules/admin/reviews/index.js
import express from "express";
import {
  getAllReviewsController,
  getReviewStatisticsController,
  deleteReviewController,
} from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Routes
router.get("/", getAllReviewsController);
router.get("/statistics", getReviewStatisticsController);
router.delete("/:reviewId", deleteReviewController);

export default router;

