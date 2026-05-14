import { prisma } from "../../utils/prisma.js";
/** Must match provider project dispute picker: these milestones cannot be linked. */
const DISPUTE_MILESTONE_EXCLUDED_STATUSES = new Set([
  "LOCKED",
  "DRAFT",
  "PAID",
  "DISBUTED",
]);

export const disputeModel = {
  async getDisputeById(disputeId) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        payment: {
          include: {
            milestone: true,
          },
        },
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return dispute;
  },

  async getDisputeByProject(projectId) {
    const dispute = await prisma.dispute.findFirst({
      where: { projectId },
      include: {
        payment: {
          include: {
            milestone: true,
          },
        },
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return dispute;
  },

  async createDispute(data) {
    const projectRow = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { status: true },
    });
    if (!projectRow) {
      throw new Error("Project not found");
    }
    if (projectRow.status === "COMPLETED") {
      throw new Error(
        "This project is completed and cannot have new disputes.",
      );
    }

    // Linked milestone must belong to this project and not be in a disallowed status
    if (data.milestoneId) {
      const milestone = await prisma.milestone.findUnique({
        where: { id: data.milestoneId },
        select: { id: true, status: true, title: true, projectId: true },
      });

      if (!milestone) {
        throw new Error("Milestone not found");
      }

      if (milestone.projectId !== data.projectId) {
        throw new Error("Milestone does not belong to this project");
      }

      if (DISPUTE_MILESTONE_EXCLUDED_STATUSES.has(milestone.status)) {
        throw new Error(
          `Disputes cannot be linked to milestone "${milestone.title}" while it is ${milestone.status}.`,
        );
      }
    }

    // Check if a dispute already exists for this project
    const existingDispute = await prisma.dispute.findFirst({
      where: { projectId: data.projectId },
      orderBy: { createdAt: "desc" },
    });

    if (existingDispute) {
      const isTerminal =
        existingDispute.status === "CLOSED" ||
        existingDispute.status === "RESOLVED";

      // Only merge into an existing row when it is still open; closed/resolved → create a new dispute
      if (!isTerminal) {
        return await this.updateDispute(existingDispute.id, {
          reason: data.reason,
          description: data.description,
          milestoneId: data.milestoneId || existingDispute.milestoneId,
          paymentId: data.paymentId || existingDispute.paymentId,
          contestedAmount: data.contestedAmount || existingDispute.contestedAmount,
          suggestedResolution: data.suggestedResolution || existingDispute.suggestedResolution,
          attachments: data.attachments || existingDispute.attachments,
          status: existingDispute.status === "RESOLVED" ? "UNDER_REVIEW" : existingDispute.status,
        });
      }
    }

    const dispute = await prisma.dispute.create({
      data: {
        paymentId: data.paymentId || null,
        projectId: data.projectId,
        raisedById: data.raisedById,
        milestoneId: data.milestoneId || null,
        reason: data.reason,
        description: data.description,
        contestedAmount: data.contestedAmount || null,
        suggestedResolution: data.suggestedResolution || null,
        attachments: data.attachments || [],
        status: "OPEN",
      },
      include: {
        payment: {
          include: {
            milestone: true,
          },
        },
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Freeze the linked milestone (eligible status — validated above)
    if (data.milestoneId) {
      await prisma.milestone.update({
        where: { id: data.milestoneId },
        data: {
          status: "DISPUTED",
        },
      });
    }

    // Project-level disputes (no milestone) still surface in admin as DISPUTED
    await prisma.project.update({
      where: { id: data.projectId },
      data: {
        status: "DISPUTED",
      },
    });

    return dispute;
  },

  async updateDispute(disputeId, data) {
    if (data.milestoneId !== undefined && data.milestoneId !== null && data.milestoneId !== "") {
      const milestone = await prisma.milestone.findUnique({
        where: { id: data.milestoneId },
        select: { id: true, status: true, title: true, projectId: true },
      });

      if (!milestone) {
        throw new Error("Milestone not found");
      }

      const disputeRow = await prisma.dispute.findUnique({
        where: { id: disputeId },
        select: { projectId: true },
      });
      if (milestone.projectId !== disputeRow?.projectId) {
        throw new Error("Milestone does not belong to this project");
      }

      if (DISPUTE_MILESTONE_EXCLUDED_STATUSES.has(milestone.status)) {
        throw new Error(
          `Disputes cannot be linked to milestone "${milestone.title}" while it is ${milestone.status}.`,
        );
      }
    }

    // Merge existing attachments with new ones if provided
    let attachments = data.attachments;
    if (attachments && Array.isArray(attachments)) {
      const existingDispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        select: { attachments: true },
      });
      if (existingDispute?.attachments?.length > 0) {
        attachments = [...existingDispute.attachments, ...attachments];
      }
    }

    const dispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        ...(data.reason && { reason: data.reason }),
        ...(data.description && { description: data.description }),
        ...(data.milestoneId !== undefined && { milestoneId: data.milestoneId }),
        ...(data.paymentId !== undefined && { paymentId: data.paymentId }),
        ...(data.contestedAmount !== undefined && { contestedAmount: data.contestedAmount }),
        ...(data.suggestedResolution !== undefined && { suggestedResolution: data.suggestedResolution }),
        ...(attachments && { attachments }),
        ...(data.status && { status: data.status }),
        updatedAt: new Date(),
      },
      include: {
        payment: {
          include: {
            milestone: true,
          },
        },
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update milestone status if milestoneId changed
    if (data.milestoneId) {
      await prisma.milestone.update({
        where: { id: data.milestoneId },
        data: {
          status: "DISPUTED",
        },
      });

      // Update project status to DISPUTED if not already
      await prisma.project.update({
        where: { id: dispute.projectId },
        data: {
          status: "DISPUTED",
        },
      });
    }

    return dispute;
  },

  async getDisputesByProject(projectId) {
    const disputes = await prisma.dispute.findMany({
      where: { projectId },
      include: {
        payment: {
          include: {
            milestone: true,
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return disputes;
  },

  async updateDisputeStatus(disputeId, status, resolution = null) {
    const dispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: status.toUpperCase(),
        resolution: resolution || undefined,
        updatedAt: new Date(),
      },
      include: {
        payment: {
          include: {
            milestone: true,
          },
        },
        project: true,
      },
    });

    return dispute;
  },
};

export default prisma;

