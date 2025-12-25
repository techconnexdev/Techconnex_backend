// src/modules/provider/send-proposal/index.js
import express from "express";
import {
  sendProposalController,
  getProposalsController,
  getProposalController,
  updateProposalController,
  deleteProposalController,
  getProposalMilestonesController,
  updateProposalMilestonesController,
} from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";


const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.post(
  "/",
  sendProposalController
);
router.get("/", getProposalsController);
router.get("/:id", getProposalController);
router.put("/:id", updateProposalController);
router.delete("/:id", deleteProposalController);

// Proposal milestone management routes
router.get("/:id/milestones", getProposalMilestonesController);
router.post("/:id/milestones", updateProposalMilestonesController);


export default router;