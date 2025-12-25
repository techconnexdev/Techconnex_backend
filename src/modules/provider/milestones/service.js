// src/modules/provider/milestones/service.js
import { prisma } from "./model.js";
import { UpsertMilestonesDto } from "./dto.js";
import { createNotification } from "../../notifications/service.js";

/**
 * Assert that the project is owned by the provider
 */
async function assertProjectOwnedByProvider(projectId, providerId) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      providerId: providerId,
    },
    include: {
      milestones: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!project) {
    throw new Error(
      "Project not found or you don't have permission to access it"
    );
  }

  return project;
}

/**
 * Get project milestones for provider
 */
export async function getProjectMilestones(projectId, providerId) {
  try {
    const project = await assertProjectOwnedByProvider(projectId, providerId);

    return {
      milestones: project.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        order: m.order,
        status: m.status,
        startDeliverables: m.startDeliverables,
        submitDeliverables: m.submitDeliverables,
        submissionAttachmentUrl: m.submissionAttachmentUrl,
        submissionNote: m.submissionNote,
        submittedAt: m.submittedAt,
        revisionNumber: m.revisionNumber,
        submissionHistory: m.submissionHistory,
      })),
      milestonesLocked: project.milestonesLocked,
      companyApproved: project.companyApproved,
      providerApproved: project.providerApproved,
      milestonesApprovedAt: project.milestonesApprovedAt,
    };
  } catch (error) {
    console.error("Error fetching project milestones:", error);
    throw error;
  }
}

/**
 * Update project milestones as provider
 */
export async function updateProjectMilestones(
  projectId,
  providerId,
  milestones
) {
  try {
    const project = await assertProjectOwnedByProvider(projectId, providerId);

    // Check if milestones are locked
    if (project.milestonesLocked) {
      throw new Error("Project milestones are locked and cannot be edited");
    }

    // Validate milestones
    const dto = new UpsertMilestonesDto({ milestones });
    const validationErrors = dto.validate();
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
    }

    // Sanitize and normalize
    dto.sanitize();
    dto.normalizeSequences();

    // Update project milestones in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing milestones
      await tx.milestone.deleteMany({
        where: { projectId: projectId },
      });

      // Create new milestones
      if (dto.milestones.length > 0) {
        await tx.milestone.createMany({
          data: dto.milestones.map((m) => ({
            projectId: projectId,
            title: m.title,
            description: m.description || "",
            amount: m.amount,
            dueDate: new Date(m.dueDate),
            order: m.sequence || 1,
            status: "DRAFT",
            source: "FINAL",
          })),
        });
      }

      // Reset approval flags when milestones are edited
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: {
          companyApproved: false,
          providerApproved: false,
          milestonesApprovedAt: null,
        },
        include: {
          milestones: {
            orderBy: { order: "asc" },
          },
        },
      });

      return updatedProject;
    });

    // Notify company when provider updates milestones
    try {
      const projectWithCustomer = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          customerId: true,
          title: true,
        },
      });

      if (projectWithCustomer?.customerId) {
        await createNotification({
          userId: projectWithCustomer.customerId,
          title: "Milestones Updated",
          type: "milestone",
          content: `The provider has updated the milestones for project "${projectWithCustomer.title}". Please review and approve.`,
          metadata: {
            projectId: projectId,
            projectTitle: projectWithCustomer.title,
            eventType: "milestones_updated",
          },
        });
      }
    } catch (notificationError) {
      console.error("Failed to notify company of milestone update:", notificationError);
    }

    return {
      milestones: result.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        order: m.order,
        status: m.status,
      })),
      milestonesLocked: result.milestonesLocked,
      companyApproved: result.companyApproved,
      providerApproved: result.providerApproved,
      milestonesApprovedAt: result.milestonesApprovedAt,
    };
  } catch (error) {
    console.error("Error updating project milestones:", error);
    throw error;
  }
}

/**
 * Approve milestones as provider
 */
export async function approveMilestones(projectId, providerId) {
  try {
    const project = await assertProjectOwnedByProvider(projectId, providerId);

    // Check if milestones are locked
    if (project.milestonesLocked) {
      throw new Error("Project milestones are already locked");
    }

    // Check if there are milestones to approve
    if (project.milestones.length === 0) {
      throw new Error("No milestones to approve");
    }

    // Update provider approval
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        providerApproved: true,
      },
      include: {
        milestones: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Check if both parties have approved
    if (updatedProject.companyApproved && updatedProject.providerApproved) {
      // Lock milestones and mark them as approved
      const finalProject = await prisma.$transaction(async (tx) => {
        // Update project to lock milestones
        const lockedProject = await tx.project.update({
          where: { id: projectId },
          data: {
            milestonesLocked: true,
            milestonesApprovedAt: new Date(),
          },
        });

        // Update all milestones to LOCKED status (ready to start work)
        await tx.milestone.updateMany({
          where: { projectId: projectId },
          data: { status: "LOCKED" },
        });

        // Create PENDING payments for each milestone now that both parties approved
        const platformPercentage = 0.1;
        const milestones = await tx.milestone.findMany({
          where: { projectId: projectId },
          orderBy: { order: "asc" },
        });

        for (const m of milestones) {
          const existing = await tx.payment.findFirst({
            where: { milestoneId: m.id },
          });
          if (existing) continue;

          const platformFee =
            Math.round(m.amount * platformPercentage * 100) / 100;
          const providerAmount =
            Math.round((m.amount - platformFee) * 100) / 100;

          await tx.payment.create({
            data: {
              projectId: projectId,
              milestoneId: m.id,
              amount: m.amount,
              platformFeeAmount: platformFee,
              providerAmount: providerAmount,
              currency: "MYR",
              status: "PENDING",
              method: "PENDING",
              metadata: { milestoneTitle: m.title },
            },
          });
        }

        return lockedProject;
      });

      // Notify company when milestones are locked (both parties approved)
      try {
        const projectWithCustomer = await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            customerId: true,
            title: true,
          },
        });

        if (projectWithCustomer?.customerId) {
          await createNotification({
            userId: projectWithCustomer.customerId,
            title: "Milestones Approved & Locked",
            type: "milestone",
            content: `All milestones for project "${projectWithCustomer.title}" have been approved and locked. The provider can now start working.`,
            metadata: {
              projectId: projectId,
              projectTitle: projectWithCustomer.title,
              eventType: "milestones_locked",
            },
          });
        }
      } catch (notificationError) {
        console.error("Failed to notify company of milestone lock:", notificationError);
      }

      return {
        approved: true,
        locked: true,
        milestones: updatedProject.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          amount: m.amount,
          dueDate: m.dueDate,
          order: m.order,
          status: "LOCKED",
        })),
        milestonesLocked: true,
        companyApproved: true,
        providerApproved: true,
        milestonesApprovedAt: finalProject.milestonesApprovedAt,
      };
    }

    // Notify company when provider approves milestones (but not yet locked)
    try {
      const projectWithCustomer = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          customerId: true,
          title: true,
        },
      });

      if (projectWithCustomer?.customerId) {
        await createNotification({
          userId: projectWithCustomer.customerId,
          title: "Milestones Approved by Provider",
          type: "milestone",
          content: `The provider has approved the milestones for project "${projectWithCustomer.title}". Please approve to lock them.`,
          metadata: {
            projectId: projectId,
            projectTitle: projectWithCustomer.title,
            eventType: "milestones_approved_by_provider",
          },
        });
      }
    } catch (notificationError) {
      console.error("Failed to notify company of milestone approval:", notificationError);
    }

    return {
      approved: true,
      locked: false,
      milestones: updatedProject.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        order: m.order,
        status: m.status,
      })),
      milestonesLocked: updatedProject.milestonesLocked,
      companyApproved: updatedProject.companyApproved,
      providerApproved: updatedProject.providerApproved,
      milestonesApprovedAt: updatedProject.milestonesApprovedAt,
    };
  } catch (error) {
    console.error("Error approving milestones:", error);
    throw error;
  }
}
