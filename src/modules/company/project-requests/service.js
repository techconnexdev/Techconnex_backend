// src/modules/company/project-requests/service.js
import { prisma } from "./model.js";
import {
  GetProjectRequestsDto,
  AcceptProposalDto,
  RejectProposalDto,
} from "./dto.js";
import { rankProposals } from "./bid-ranking.js";

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
    // When fetching for a single project, get more proposals so we can rank and show best 5
    const takeLimit = dto.serviceRequestId ? Math.min(100, Math.max(dto.limit, 50)) : dto.limit;

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
                  profileImageUrl: true,
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
              skills: true,
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
              daysFromStart: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: dto.serviceRequestId ? 0 : skip,
        take: dto.serviceRequestId ? takeLimit : dto.limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    let resultProposals = proposals;
    if (proposals.length > 0) {
      if (dto.serviceRequestId) {
        const serviceRequest = proposals[0].serviceRequest || null;
        resultProposals = rankProposals(proposals, serviceRequest);
      } else {
        // Attach matchScore for each proposal by grouping by service request and ranking
        const scoreMap = new Map(); // proposalId -> { matchScore, rank, isTopFive }
        const byServiceRequest = new Map();
        for (const p of proposals) {
          const srId = p.serviceRequestId;
          if (!byServiceRequest.has(srId)) byServiceRequest.set(srId, []);
          byServiceRequest.get(srId).push(p);
        }
        for (const [, group] of byServiceRequest) {
          const sr = group[0]?.serviceRequest || null;
          const ranked = rankProposals(group, sr);
          for (const r of ranked) {
            scoreMap.set(r.id, { matchScore: r.matchScore, rank: r.rank, isTopFive: r.isTopFive });
          }
        }
        resultProposals = proposals.map((p) => {
          const att = scoreMap.get(p.id);
          return att ? { ...p, matchScore: att.matchScore, rank: att.rank, isTopFive: att.isTopFive } : p;
        });
      }
    }

    const totalPages = dto.serviceRequestId ? 1 : Math.ceil(total / dto.limit);

    return {
      proposals: resultProposals,
      pagination: {
        page: dto.serviceRequestId ? 1 : dto.page,
        limit: dto.serviceRequestId ? resultProposals.length : dto.limit,
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

    // Helper: placeholder due date until project starts (then set from startedAt + daysFromStart)
    const placeholderDueDate = (daysFromStart) => {
      const days = daysFromStart != null ? Number(daysFromStart) : 0;
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    };

    // Choose milestones based on useProviderMilestones flag (use daysFromStart; dueDate is set at lock)
    let chosenMilestones = [];
    let chosenMilestoneSource = "COMPANY";

    if (dto.useProviderMilestones && proposal.milestones.length > 0) {
      chosenMilestones = proposal.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        daysFromStart: m.daysFromStart ?? (m.dueDate ? Math.ceil((new Date(m.dueDate) - Date.now()) / (24 * 60 * 60 * 1000)) : null),
        order: m.order,
        status: "PENDING",
        source: "FINAL",
      }));
      chosenMilestoneSource = "PROVIDER";
    } else if (proposal.serviceRequest.milestones.length > 0) {
      chosenMilestones = proposal.serviceRequest.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        daysFromStart: m.daysFromStart ?? (m.dueDate ? Math.ceil((new Date(m.dueDate) - Date.now()) / (24 * 60 * 60 * 1000)) : null),
        order: m.order,
        status: "PENDING",
        source: "FINAL",
      }));
      chosenMilestoneSource = "COMPANY";
    } else {
      const deliveryDays = proposal.deliveryTime ? Number(proposal.deliveryTime) : 30;
      chosenMilestones = [
        {
          title: "Full project",
          description: "Complete project delivery",
          amount: proposal.bidAmount,
          daysFromStart: deliveryDays,
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
          milestonesLocked: false,
          companyApproved: false,
          providerApproved: false,
          milestones: {
            create: chosenMilestones.map((m) => ({
              title: m.title,
              description: m.description ?? "",
              amount: m.amount,
              dueDate: placeholderDueDate(m.daysFromStart),
              daysFromStart: m.daysFromStart ?? null,
              order: m.order,
              status: "DRAFT",
              source: "FINAL",
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

      // Notify provider (with projectId + linkPath for grouping and click-through)
      await tx.notification.create({
        data: {
          userId: proposal.providerId,
          title: "Proposal Accepted",
          type: "proposal",
          content: "Congratulations! Your proposal has been accepted. You can start working once the escrow is confirmed.",
          metadata: {
            projectId: project.id,
            projectTitle: project.title,
            eventType: "proposal_accepted",
            linkPath: `/provider/projects/${project.id}`,
          },
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

    // Notify provider (linkPath to opportunities; no projectId for rejected)
    const projectId = proposal.serviceRequest.projectId || null;
    await prisma.notification.create({
      data: {
        userId: proposal.providerId,
        title: "Proposal Update",
        type: "proposal",
        content: `Your proposal for "${
          proposal.serviceRequest.title
        }" has been rejected.${dto.reason ? ` Reason: ${dto.reason}` : ""}`,
        metadata: {
          ...(projectId && { projectId }),
          projectTitle: proposal.serviceRequest.title,
          eventType: "proposal_rejected",
          linkPath: projectId ? `/provider/projects/${projectId}` : "/provider/opportunities",
        },
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
