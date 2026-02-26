// src/modules/company/milestones/service.js
import { prisma } from "./model.js"
import { UpsertMilestonesDto } from "./dto.js"
import { createNotification } from "../../notifications/service.js"

/**
 * Assert that the project is owned by the customer
 */
async function assertProjectOwnedByCompany(projectId, customerId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      customerId: customerId
    },
    include: {
      milestones: {
        orderBy: { order: "asc" }
      }
    }
  })

  if (!project) {
    throw new Error("Project not found or you don't have permission to access it")
  }

  return project
}

/**
 * Get project milestones for company
 */
export async function getProjectMilestones(projectId, customerId) {
  try {
    const project = await assertProjectOwnedByCompany(projectId, customerId)

    return {
      milestones: project.milestones.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        daysFromStart: m.daysFromStart,
        order: m.order,
        status: m.status,
        startDeliverables: m.startDeliverables,
        submitDeliverables: m.submitDeliverables,
        submissionAttachmentUrl: m.submissionAttachmentUrl,
        submissionNote: m.submissionNote,
        submittedAt: m.submittedAt,
        revisionNumber: m.revisionNumber,
        submissionHistory: m.submissionHistory
      })),
      milestonesLocked: project.milestonesLocked,
      companyApproved: project.companyApproved,
      providerApproved: project.providerApproved,
      milestonesApprovedAt: project.milestonesApprovedAt
    }
  } catch (error) {
    console.error("Error fetching project milestones:", error)
    throw error
  }
}

/**
 * Update project milestones as company
 */
export async function updateProjectMilestones(projectId, customerId, milestones) {
  try {
    const project = await assertProjectOwnedByCompany(projectId, customerId)

    // Check if milestones are locked
    if (project.milestonesLocked) {
      throw new Error("Project milestones are locked and cannot be edited")
    }

    // Validate milestones
    const dto = new UpsertMilestonesDto({ milestones })
    const validationErrors = dto.validate()
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(", ")}`)
    }

    // Sanitize and normalize
    dto.sanitize()
    dto.normalizeSequences()

    // Update project milestones in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing milestones
      await tx.milestone.deleteMany({
        where: { projectId: projectId }
      })

      // Create new milestones (daysFromStart; dueDate placeholder until project starts)
      if (dto.milestones.length > 0) {
        const now = Date.now()
        await tx.milestone.createMany({
          data: dto.milestones.map(m => {
            const days = m.daysFromStart != null ? Number(m.daysFromStart) : 0
            return {
              projectId: projectId,
              title: m.title,
              description: m.description || "",
              amount: m.amount,
              dueDate: new Date(now + days * 24 * 60 * 60 * 1000),
              daysFromStart: m.daysFromStart != null ? Number(m.daysFromStart) : null,
              order: m.sequence || 1,
              status: "DRAFT",
              source: "FINAL"
            }
          })
        })
      }

      // Reset approval flags when milestones are edited
      const updatedProject = await tx.project.update({
        where: { id: projectId },
      data: {
          companyApproved: false,
          providerApproved: false,
          milestonesApprovedAt: null
        },
        include: {
          milestones: {
            orderBy: { order: "asc" }
          }
        }
      })

      return updatedProject
    })

    // Notify provider when company updates milestones
    try {
      const projectWithProvider = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          providerId: true,
          title: true,
        },
      });

      if (projectWithProvider?.providerId) {
        await createNotification({
          userId: projectWithProvider.providerId,
          title: "Milestones Updated",
          type: "milestone",
          content: `The company has updated the milestones for project "${projectWithProvider.title}". Please review and approve.`,
          metadata: {
            projectId: projectId,
            projectTitle: projectWithProvider.title,
            eventType: "milestones_updated",
            linkPath: `/provider/projects/${projectId}`,
          },
        });
      }
    } catch (notificationError) {
      console.error("Failed to notify provider of milestone update:", notificationError);
    }

    return {
      milestones: result.milestones.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        daysFromStart: m.daysFromStart,
        order: m.order,
        status: m.status
      })),
      milestonesLocked: result.milestonesLocked,
      companyApproved: result.companyApproved,
      providerApproved: result.providerApproved,
      milestonesApprovedAt: result.milestonesApprovedAt
    }
  } catch (error) {
    console.error("Error updating project milestones:", error)
    throw error
  }
}

/**
 * Approve milestones as company
 */
export async function approveMilestones(projectId, customerId) {
  try {
    const project = await assertProjectOwnedByCompany(projectId, customerId)

    // Check if milestones are locked
    if (project.milestonesLocked) {
      throw new Error("Project milestones are already locked")
    }

    // Check if there are milestones to approve
    if (project.milestones.length === 0) {
      throw new Error("No milestones to approve")
    }

    // Update company approval
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        companyApproved: true
      },
      include: {
        milestones: {
          orderBy: { order: "asc" }
        }
      }
    })

    // Check if both parties have approved
    if (updatedProject.companyApproved && updatedProject.providerApproved) {
      const startedAt = new Date()
      // Lock milestones, set project start date, and compute due dates from daysFromStart
      const finalProject = await prisma.$transaction(async (tx) => {
        const lockedProject = await tx.project.update({
          where: { id: projectId },
          data: {
            milestonesLocked: true,
            milestonesApprovedAt: startedAt,
            startedAt: startedAt
          }
        })

        // Set each milestone to LOCKED and set dueDate = startedAt + daysFromStart
        const milestones = await tx.milestone.findMany({
          where: { projectId: projectId },
          orderBy: { order: "asc" }
        })
        for (const m of milestones) {
          const days = m.daysFromStart != null ? m.daysFromStart : 0
          const dueDate = new Date(startedAt.getTime() + days * 24 * 60 * 60 * 1000)
          await tx.milestone.update({
            where: { id: m.id },
            data: { status: "LOCKED", dueDate }
          })
        }

        return lockedProject
      })

      // Notify provider when milestones are locked (both parties approved)
      try {
        const projectWithProvider = await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            providerId: true,
            title: true,
          },
        });

        if (projectWithProvider?.providerId) {
          await createNotification({
            userId: projectWithProvider.providerId,
            title: "Milestones Approved & Locked",
            type: "milestone",
            content: `All milestones for project "${projectWithProvider.title}" have been approved and locked. You can now start working on the first milestone.`,
            metadata: {
              projectId: projectId,
              projectTitle: projectWithProvider.title,
              eventType: "milestones_locked",
              linkPath: `/provider/projects/${projectId}`,
            },
          });
        }
      } catch (notificationError) {
        console.error("Failed to notify provider of milestone lock:", notificationError);
      }

      const lockedMilestones = await prisma.milestone.findMany({
        where: { projectId: projectId },
        orderBy: { order: "asc" }
      })
      return {
        approved: true,
        locked: true,
        milestones: lockedMilestones.map(m => ({
          id: m.id,
          title: m.title,
          description: m.description,
          amount: m.amount,
          dueDate: m.dueDate,
          daysFromStart: m.daysFromStart,
          order: m.order,
          status: "LOCKED"
        })),
        milestonesLocked: true,
        companyApproved: true,
        providerApproved: true,
        milestonesApprovedAt: finalProject.milestonesApprovedAt
      }
    }

    // Notify provider when company approves milestones (but not yet locked)
    try {
      const projectWithProvider = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          providerId: true,
          title: true,
        },
      });

      if (projectWithProvider?.providerId) {
        await createNotification({
          userId: projectWithProvider.providerId,
          title: "Milestones Approved by Company",
          type: "milestone",
          content: `The company has approved the milestones for project "${projectWithProvider.title}". Please approve to lock them.`,
          metadata: {
            projectId: projectId,
            projectTitle: projectWithProvider.title,
            eventType: "milestones_approved_by_company",
            linkPath: `/provider/projects/${projectId}`,
          },
        });
      }
    } catch (notificationError) {
      console.error("Failed to notify provider of milestone approval:", notificationError);
    }

    return {
      approved: true,
      locked: false,
      milestones: updatedProject.milestones.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        order: m.order,
        status: m.status
      })),
      milestonesLocked: updatedProject.milestonesLocked,
      companyApproved: updatedProject.companyApproved,
      providerApproved: updatedProject.providerApproved,
      milestonesApprovedAt: updatedProject.milestonesApprovedAt
    }
  } catch (error) {
    console.error("Error approving milestones:", error)
    throw error
  }
}
