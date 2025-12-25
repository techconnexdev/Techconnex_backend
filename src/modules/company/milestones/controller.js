// src/modules/company/milestones/controller.js
import { getProjectMilestones, updateProjectMilestones, approveMilestones } from "./service.js"

/**
 * GET /:projectId - Get project milestones
 */
export async function getProjectMilestonesController(req, res) {
  try {
    const projectId = req.params.projectId
    const customerId = req.user.userId

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required"
      })
    }

    const result = await getProjectMilestones(projectId, customerId)

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("Error in getProjectMilestonesController:", error)
    res.status(400).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * PUT /:projectId - Update project milestones
 */
export async function updateProjectMilestonesController(req, res) {
  try {
    const projectId = req.params.projectId
    const customerId = req.user.userId
    const { milestones } = req.body

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required"
      })
    }

    if (!milestones) {
      return res.status(400).json({
        success: false,
        message: "Milestones are required"
      })
    }

    const result = await updateProjectMilestones(projectId, customerId, milestones)

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("Error in updateProjectMilestonesController:", error)
    res.status(400).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * POST /:projectId/approve - Approve milestones
 */
export async function approveMilestonesController(req, res) {
  try {
    const projectId = req.params.projectId
    const customerId = req.user.userId

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required"
      })
    }

    const result = await approveMilestones(projectId, customerId)

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("Error in approveMilestonesController:", error)
    res.status(400).json({
      success: false,
      message: error.message
    })
  }
}
