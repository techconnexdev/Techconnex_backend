/**
 * Public Homepage Routes
 * No auth middleware — safe for unauthenticated visitors.
 * Exposes aggregated data to drive organic registrations.
 */
import express from "express";
import { getHomepageData } from "./controller.js";

const router = express.Router();

router.get("/", getHomepageData);

export default router;
