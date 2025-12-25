// src/modules/company/milestones/index.js
import express from "express"
import { authenticateToken } from "../../../middlewares/auth.js"
import { getProjectMilestonesController, updateProjectMilestonesController, approveMilestonesController } from "./controller.js"

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// GET /:projectId - Get project milestones
router.get("/:projectId", getProjectMilestonesController)

// PUT /:projectId - Update project milestones
router.put("/:projectId", updateProjectMilestonesController)

// POST /:projectId/approve - Approve milestones
router.post("/:projectId/approve", approveMilestonesController)

export default router
