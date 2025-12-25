// src/modules/provider/send-proposal/service.js
import { prisma } from "./model.js";
import { SendProposalDto, GetProposalsDto } from "./dto.js";
import { createNotification } from "../../notifications/service.js";

export async function sendProposal(dto) {
  try {
    // Check if provider already sent a proposal for this service request
    const existingProposal = await prisma.proposal.findFirst({
      where: {
        providerId: dto.providerId,
        serviceRequestId: dto.serviceRequestId,
      },
    });

    if (existingProposal) {
      throw new Error("You have already sent a proposal for this service request");
    }

    // Check if the service request exists and is open
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: dto.serviceRequestId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!serviceRequest) {
      throw new Error("Service request not found");
    }

    if (serviceRequest.status !== "OPEN") {
      throw new Error("This service request is no longer accepting proposals");
    }

    // Check for self-bidding
    if (serviceRequest.customerId === dto.providerId) {
      throw new Error("You cannot propose to your own service request");
    }

    // Check if bid amount is within the budget range
    if (dto.bidAmount < serviceRequest.budgetMin || dto.bidAmount > serviceRequest.budgetMax) {
      throw new Error("Bid amount must be within the specified budget range");
    }

    // Create the proposal with milestones in a transaction
    const proposal = await prisma.$transaction(async (tx) => {
      // Create the proposal
      const newProposal = await tx.proposal.create({
        data: {
          providerId: dto.providerId,
          serviceRequestId: dto.serviceRequestId,
          bidAmount: dto.bidAmount,
          deliveryTime: dto.deliveryTime,
          coverLetter: dto.coverLetter,
          attachmentUrls: dto.attachmentUrls,
          status: "PENDING",
        },
      });

      // Create proposal milestones if provided
      if (dto.milestones && dto.milestones.length > 0) {
        await tx.proposalMilestone.createMany({
          data: dto.milestones.map((milestone, index) => ({
            proposalId: newProposal.id,
            title: milestone.title,
            description: milestone.description,
            amount: milestone.amount,
            dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
            order: index + 1,
            status: "PENDING",
            source: "PROVIDER",
          })),
        });
      }

      return newProposal;
    });

    // Fetch the complete proposal with relations
    const completeProposal = await prisma.proposal.findUnique({
      where: { id: proposal.id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            providerProfile: {
              select: {
                rating: true,
                totalProjects: true,
                location: true,
                bio: true,
                skills: true,
              },
            },
          },
        },
        serviceRequest: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            budgetMin: true,
            budgetMax: true,
            timeline: true,
            customer: {
              select: {
                name: true,
                email: true,
                customerProfile: {
                  select: {
                    companySize: true,
                    industry: true,
                  },
                },
              },
            },
          },
        },
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    // Notify company about the new proposal
    try {
      const providerName = completeProposal.provider?.name || "a provider";
      await createNotification({
        userId: serviceRequest.customerId,
        title: "New Proposal Received",
        type: "proposal",
        content: `You have received a new proposal from ${providerName} for "${serviceRequest.title}". Bid amount: RM ${dto.bidAmount.toFixed(2)}`,
        metadata: {
          proposalId: proposal.id,
          serviceRequestId: dto.serviceRequestId,
          serviceRequestTitle: serviceRequest.title,
          providerId: dto.providerId,
          providerName: completeProposal.provider?.name || null,
          bidAmount: dto.bidAmount,
          eventType: "new_proposal",
        },
      });
    } catch (notificationError) {
      // Log error but don't fail the proposal creation
      console.error("Failed to notify company of new proposal:", notificationError);
    }

    return completeProposal;
  } catch (error) {
    console.error("Error sending proposal:", error);
    throw new Error(error.message || "Failed to send proposal");
  }
}

export async function getProposals(dto) {
  try {
    const where = {
      providerId: dto.providerId,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.serviceRequestId ? { serviceRequestId: dto.serviceRequestId } : {}),
    };

    const skip = (dto.page - 1) * dto.limit;

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        include: {
          serviceRequest: {
            select: {
              id: true, title: true, description: true, category: true,
              budgetMin: true, budgetMax: true, timeline: true, status: true,
              customer: {
                select: {
                  name: true, email: true,
                  customerProfile: { select: { companySize: true, industry: true } },
                },
              },
            },
          },
          milestones: { select: { id: true, title: true, description: true, dueDate: true, amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip, take: dto.limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    const totalPages = Math.ceil(total / dto.limit);
    return { proposals, pagination: { page: dto.page, limit: dto.limit, total, totalPages } };
  } catch (error) {
    console.error("Error fetching proposals:", error);
    throw new Error("Failed to fetch proposals");
  }
}

export async function getProposalById(proposalId, providerId) {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        providerId: providerId,
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            providerProfile: {
              select: {
                rating: true,
                totalProjects: true,
                location: true,
                bio: true,
                skills: true,
                certifications: true,
                portfolios: true,
              },
            },
          },
        },
        serviceRequest: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            budgetMin: true,
            budgetMax: true,
            timeline: true,
            priority: true,
            status: true,
            requirements: true,
            deliverables: true,
            customer: {
              select: {
                name: true,
                email: true,
                customerProfile: {
                  select: {
                    companySize: true,
                    industry: true,
                    website: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
        milestones: {
          orderBy: {
            dueDate: "asc",
          },
        },
      },
    });

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    return proposal;
  } catch (error) {
    console.error("Error fetching proposal:", error);
    throw new Error("Failed to fetch proposal");
  }
}

export async function updateProposal(proposalId, providerId, updateData) {
  try {
    // Ensure ownership + editable state
    const existing = await prisma.proposal.findFirst({
      where: { id: proposalId, providerId },
      select: { id: true, status: true },
    });
    if (!existing) throw new Error("Proposal not found");
    if (existing.status !== "PENDING") throw new Error("Only PENDING proposals can be updated");

    const proposal = await prisma.proposal.update({
      where: { id: proposalId }, // unique selector
      data: {
        bidAmount: updateData.bidAmount,
        deliveryTime: updateData.deliveryTime,
        coverLetter: updateData.coverLetter,
        attachmentUrl: updateData.attachmentUrl,
      },
      include: {
        provider: { select: { name: true, email: true } },
        serviceRequest: {
          select: {
            title: true,
            customer: { select: { name: true, email: true } },
          },
        },
      },
    });

    return proposal;
  } catch (error) {
    console.error("Error updating proposal:", error);
    throw new Error("Failed to update proposal");
  }
}

export async function deleteProposal(proposalId, providerId) {
  try {
    // Safer with deleteMany (ownership)
    const { count } = await prisma.proposal.deleteMany({
      where: { id: proposalId, providerId, status: "PENDING" },
    });
    if (count === 0) throw new Error("Proposal not found or not in PENDING status");
    return { message: "Proposal deleted successfully" };
  } catch (error) {
    console.error("Error deleting proposal:", error);
    throw new Error("Failed to delete proposal");
  }
}


// Proposal milestone management functions
export async function getProposalMilestones(proposalId, providerId) {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        providerId: providerId,
        status: "PENDING", // Only allow milestone management for pending proposals
      },
      include: {
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!proposal) {
      throw new Error("Proposal not found or not in PENDING status");
    }

    return proposal.milestones;
  } catch (error) {
    console.error("Error fetching proposal milestones:", error);
    throw new Error("Failed to fetch proposal milestones");
  }
}

export async function updateProposalMilestones(proposalId, providerId, milestones) {
  try {
    // First verify the proposal exists and is in PENDING status
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        providerId: providerId,
        status: "PENDING",
      },
    });

    if (!proposal) {
      throw new Error("Proposal not found or not in PENDING status");
    }

    // Validate milestone amounts sum to bid amount
    const totalAmount = milestones.reduce((sum, milestone) => sum + milestone.amount, 0);
    if (Math.abs(totalAmount - proposal.bidAmount) > 0.01) {
      throw new Error("Total milestone amount must equal bid amount");
    }

    // Delete existing milestones and create new ones
    await prisma.$transaction(async (tx) => {
      // Delete existing milestones
      await tx.proposalMilestone.deleteMany({
        where: {
          proposalId: proposalId,
        },
      });

      // Create new milestones
      await tx.proposalMilestone.createMany({
        data: milestones.map((milestone, index) => ({
          proposalId: proposalId,
          title: milestone.title,
          description: milestone.description,
          amount: milestone.amount,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
          order: index + 1,
          status: "PENDING",
          source: "PROVIDER",
        })),
      });
    });

    // Return updated milestones
    return await getProposalMilestones(proposalId, providerId);
  } catch (error) {
    console.error("Error updating proposal milestones:", error);
    throw new Error("Failed to update proposal milestones");
  }
}