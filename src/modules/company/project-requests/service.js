// src/modules/company/project-requests/service.js
import { prisma } from "./model.js";
import {
  GetProjectRequestsDto,
  AcceptProposalDto,
  RejectProposalDto,
} from "./dto.js";

export async function getProjectRequests(dto) {
  try {
    const where = {
      serviceRequest: {
        customerId: dto.customerId,
      },
    };

    if (dto.status) {
      where.serviceRequest = {
        ...where.serviceRequest,
        status: dto.status,
      };
    }

    if (dto.category) {
      where.serviceRequest = {
        ...where.serviceRequest,
        category: dto.category,
      };
    }

    // NEW: filter by proposal's own status if provided
    if (dto.proposalStatus) {
      where.status = dto.proposalStatus; // ACCEPTED | REJECTED | PENDING
    }

    // Filter by specific service request ID if provided
    if (dto.serviceRequestId) {
      where.serviceRequestId = dto.serviceRequestId;
    }

    const skip = (dto.page - 1) * dto.limit;

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
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
                  hourlyRate: true,
                  yearsExperience: true,
                  successRate: true,
                  responseTime: true,
                  profileImageUrl: true, // 🆕 Profile image
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
              skills: true, // Use skills, not aiStackSuggest
              timeline: true,
              priority: true,
              status: true,
              requirements: true,
              deliverables: true,
              createdAt: true,
              projectId: true,
              acceptedProposalId: true,
              chosenMilestoneSource: true,
              milestones: {
                orderBy: {
                  order: "asc",
                },
              },
              project: { select: { providerId: true } },
            },
          },
          milestones: {
            select: {
              id: true,
              title: true,
              description: true,
              dueDate: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: dto.limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    const totalPages = Math.ceil(total / dto.limit);

    return {
      proposals, // includes proposal.status now
      pagination: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Error fetching project requests:", error);
    throw new Error("Failed to fetch project requests");
  }
}

export async function getProjectRequestById(requestId, customerId) {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: requestId,
        serviceRequest: {
          customerId: customerId,
        },
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            providerProfile: {
              select: {
                rating: true,
                totalProjects: true,
                location: true,
                bio: true,
                skills: true,
                hourlyRate: true,
                yearsExperience: true,
                successRate: true,
                responseTime: true,
                availability: true,
                languages: true,
                website: true,
                certifications: {
                  select: {
                    name: true,
                    issuer: true,
                    issuedDate: true,
                    verified: true,
                  },
                },
                portfolios: {
                  select: {
                    title: true,
                    description: true,
                    techStack: true,
                    client: true,
                    date: true,
                    imageUrl: true,
                    externalUrl: true,
                  },
                },
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
            skills: true, // Use skills, not aiStackSuggest
            timeline: true,
            priority: true,
            status: true,
            requirements: true,
            deliverables: true,
            createdAt: true,
            projectId: true,
            acceptedProposalId: true,
            chosenMilestoneSource: true,
            milestones: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
        milestones: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!proposal) {
      throw new Error("Project request not found");
    }

    // proposal.status is included automatically (root scalars)
    return proposal;
  } catch (error) {
    console.error("Error fetching project request:", error);
    throw new Error("Failed to fetch project request");
  }
}

export async function acceptProposal(dto) {
  try {
    // Load proposal with all necessary relations
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: dto.proposalId,
        serviceRequest: {
          customerId: dto.customerId,
        },
      },
      include: {
        serviceRequest: {
          include: {
            milestones: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
        provider: true,
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!proposal) {
      throw new Error(
        "Proposal not found or you don't have permission to accept it"
      );
    }

    // Guard rails
    if (proposal.serviceRequest.status !== "OPEN") {
      throw new Error("This service request is no longer accepting proposals");
    }

    if (proposal.serviceRequest.projectId) {
      throw new Error(
        "This service request has already been matched to a project"
      );
    }

    // Choose milestones based on useProviderMilestones flag
    let chosenMilestones = [];
    let chosenMilestoneSource = "COMPANY";

    if (dto.useProviderMilestones && proposal.milestones.length > 0) {
      // Use provider milestones
      chosenMilestones = proposal.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        order: m.order,
        status: "PENDING",
        source: "FINAL",
      }));
      chosenMilestoneSource = "PROVIDER";
    } else if (proposal.serviceRequest.milestones.length > 0) {
      // Use company milestones
      chosenMilestones = proposal.serviceRequest.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate,
        order: m.order,
        status: "PENDING",
        source: "FINAL",
      }));
      chosenMilestoneSource = "COMPANY";
    } else {
      // Create default milestone
      chosenMilestones = [
        {
          title: "Full project",
          description: "Complete project delivery",
          amount: proposal.bidAmount,
          dueDate: null,
          order: 1,
          status: "PENDING",
          source: "FINAL",
        },
      ];
      chosenMilestoneSource = "COMPANY";
    }

    // Single transaction for all operations
    const result = await prisma.$transaction(async (tx) => {
      // Create Project (mirror fields from ServiceRequest)
      const project = await tx.project.create({
        data: {
          title: proposal.serviceRequest.title,
          description: proposal.serviceRequest.description,
          category: proposal.serviceRequest.category,
          budgetMin: proposal.serviceRequest.budgetMin,
          budgetMax: proposal.serviceRequest.budgetMax,
          skills: proposal.serviceRequest.skills, // Use skills, not aiStackSuggest
          timeline: proposal.serviceRequest.timeline,
          priority: proposal.serviceRequest.priority,
          ndaSigned: proposal.serviceRequest.ndaSigned || false,
          requirements: proposal.serviceRequest.requirements,
          deliverables: proposal.serviceRequest.deliverables,
          status: "IN_PROGRESS",
          customerId: proposal.serviceRequest.customerId,
          providerId: proposal.providerId,
          // Initialize milestone approval flags
          milestonesLocked: false,
          companyApproved: false,
          providerApproved: false,
          milestones: {
            create: chosenMilestones.map((m) => ({
              ...m,
              status: "DRAFT", // Start as DRAFT, not PENDING
            })),
          },
        },
        include: {
          customer: {
            select: {
              id: true,
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
                  profileImageUrl: true, // 🆕 Profile image
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

      // Increment totalProjects in ProviderProfile
      await tx.providerProfile.upsert({
        where: { userId: proposal.providerId },
        update: {
          totalProjects: {
            increment: 1,
          },
        },
        create: {
          userId: proposal.providerId,
          totalProjects: 1,
        },
      });

      // Update ServiceRequest (ignore draft fields - they're no longer used)
      await tx.serviceRequest.update({
        where: { id: proposal.serviceRequest.id },
        data: {
          status: "MATCHED",
          projectId: project.id,
          acceptedProposalId: proposal.id,
          chosenMilestoneSource: chosenMilestoneSource,
        },
      });

      // Mark accepted proposal
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: "ACCEPTED" },
      });

      // Mark all other proposals for this SR as REJECTED
      await tx.proposal.updateMany({
        where: {
          serviceRequestId: proposal.serviceRequest.id,
          id: { not: proposal.id },
        },
        data: { status: "REJECTED" },
      });

      // Notify provider
      await tx.notification.create({
        data: {
          userId: proposal.providerId,
          title: "Proposal Accepted",
          type: "proposal",
          content: `Your proposal for "${proposal.serviceRequest.title}" has been accepted!`,
        },
      });

      return project;
    });

    return result;
  } catch (error) {
    console.error("Error accepting proposal:", error);
    throw new Error(error.message || "Failed to accept proposal");
  }
}

export async function rejectProposal(dto) {
  try {
    // Ensure the proposal belongs to a service request owned by the customer
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: dto.proposalId,
        serviceRequest: {
          customerId: dto.customerId,
        },
      },
      include: {
        serviceRequest: true,
        provider: true,
      },
    });

    if (!proposal) {
      throw new Error(
        "Proposal not found or you don't have permission to reject it"
      );
    }

    // Persist rejection
    await prisma.proposal.update({
      where: { id: dto.proposalId },
      data: { status: "REJECTED" },
    });

    // Notify provider
    await prisma.notification.create({
      data: {
        userId: proposal.providerId,
        title: "proposal Update",
        type: "proposal",
        content: `Your proposal for "${
          proposal.serviceRequest.title
        }" has been rejected.${dto.reason ? ` Reason: ${dto.reason}` : ""}`,
      },
    });

    return { message: "Proposal rejected successfully" };
  } catch (error) {
    console.error("Error rejecting proposal:", error);
    throw new Error(error.message || "Failed to reject proposal");
  }
}

export async function getProposalStats(customerId) {
  try {
    const stats = await prisma.proposal.groupBy({
      by: ["serviceRequestId"],
      where: {
        serviceRequest: {
          customerId: customerId,
        },
      },
      _count: { id: true },
    });

    const totalProposals = await prisma.proposal.count({
      where: {
        serviceRequest: { customerId },
      },
    });

    const openRequests = await prisma.serviceRequest.count({
      where: { customerId, status: "OPEN" },
    });

    const matchedRequests = await prisma.serviceRequest.count({
      where: { customerId, status: "MATCHED" },
    });

    return {
      totalProposals,
      openRequests,
      matchedRequests,
      averageProposalsPerRequest:
        stats.length > 0 ? totalProposals / stats.length : 0,
    };
  } catch (error) {
    console.error("Error fetching proposal stats:", error);
    throw new Error("Failed to fetch proposal statistics");
  }
}
