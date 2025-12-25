import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    // Check if a dispute already exists for this project
    const existingDispute = await prisma.dispute.findFirst({
      where: { projectId: data.projectId },
      orderBy: { createdAt: "desc" },
    });

    if (existingDispute) {
      // If dispute is CLOSED or RESOLVED, don't allow new updates
      if (existingDispute.status === "CLOSED" || existingDispute.status === "RESOLVED") {
        throw new Error("This project has a closed or resolved dispute and cannot have new disputes");
      }
      
      // If dispute exists and is not CLOSED/RESOLVED, update it instead
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

    // Freeze the milestone if one is associated
    if (data.milestoneId) {
      await prisma.milestone.update({
        where: { id: data.milestoneId },
        data: {
          status: "DISPUTED",
        },
      });

      // Update project status to DISPUTED if not already
      await prisma.project.update({
        where: { id: data.projectId },
        data: {
          status: "DISPUTED",
        },
      });
    }

    return dispute;
  },

  async updateDispute(disputeId, data) {
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

