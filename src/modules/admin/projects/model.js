import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const adminProjectModel = {
  async getAllProjects(filters = {}) {
    // Build where clause for Projects
    const projectWhere = {};

    if (filters.status && filters.status !== "all") {
      // Only filter by status for Projects (ServiceRequests have different status enum)
      if (["IN_PROGRESS", "COMPLETED", "DISPUTED"].includes(filters.status.toUpperCase())) {
        projectWhere.status = filters.status.toUpperCase();
      }
    }

    if (filters.search) {
      projectWhere.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Build where clause for ServiceRequests
    const serviceRequestWhere = {
      status: "OPEN", // Only show unmatched opportunities
    };

    if (filters.search) {
      serviceRequestWhere.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Fetch both Projects and ServiceRequests in parallel
    const [projects, serviceRequests] = await Promise.all([
      prisma.project.findMany({
        where: projectWhere,
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
          milestones: {
            orderBy: {
              order: "asc",
            },
          },
          Dispute: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.serviceRequest.findMany({
        where: serviceRequestWhere,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          proposals: {
            select: {
              id: true,
              status: true,
              provider: {
                select: {
                  id: true,
                  name: true,
                  email: true,
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
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    // Transform Projects to include type
    const projectsWithType = projects.map((project) => ({
      ...project,
      type: "project",
    }));

    // Transform ServiceRequests to match Project structure and include type
    const serviceRequestsWithType = serviceRequests.map((sr) => ({
      id: sr.id,
      title: sr.title,
      description: sr.description,
      category: sr.category,
      budgetMin: sr.budgetMin,
      budgetMax: sr.budgetMax,
      skills: sr.skills,
      timeline: sr.timeline,
      priority: sr.priority,
      ndaSigned: sr.ndaSigned,
      requirements: sr.requirements,
      deliverables: sr.deliverables,
      status: "OPEN", // ServiceRequests are always OPEN (unmatched)
      customer: sr.customer,
      provider: null, // No provider yet for ServiceRequests
      milestones: sr.milestones || [],
      Dispute: [], // ServiceRequests can't have disputes yet
      proposals: sr.proposals || [],
      proposalsCount: sr.proposals?.length || 0,
      createdAt: sr.createdAt,
      updatedAt: sr.updatedAt,
      type: "serviceRequest", // Mark as ServiceRequest
    }));

    // Combine and sort by creation date (most recent first)
    const allItems = [...projectsWithType, ...serviceRequestsWithType].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return allItems;
  },

  async getProjectById(projectId) {
    // Try to find as Project first
    let project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        customer: {
          include: {
            customerProfile: true,
          },
        },
        provider: {
          include: {
            providerProfile: true,
          },
        },
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
        Dispute: {
          include: {
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
        },
      },
    });

    if (project) {
      // Find the ServiceRequest that created this Project to get all proposals
      const serviceRequest = await prisma.serviceRequest.findFirst({
        where: {
          projectId: project.id,
        },
        select: {
          id: true,
          timeline: true, // Original company timeline
          acceptedProposalId: true,
        },
      });

      // Get all proposals for this ServiceRequest
      let allProposals = [];
      let acceptedProposal = null;
      
      if (serviceRequest?.id) {
        allProposals = await prisma.proposal.findMany({
          where: {
            serviceRequestId: serviceRequest.id,
          },
          select: {
            id: true,
            bidAmount: true,
            deliveryTime: true,
            coverLetter: true,
            attachmentUrls: true,
            status: true,
            createdAt: true,
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
                    profileImageUrl: true,
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
          orderBy: {
            createdAt: "desc",
          },
        });

        // Find the accepted proposal
        if (serviceRequest.acceptedProposalId) {
          acceptedProposal = allProposals.find(p => p.id === serviceRequest.acceptedProposalId);
        }
      }

      return {
        ...project,
        type: "project",
        proposal: acceptedProposal, // Accepted proposal (for backward compatibility)
        proposals: allProposals, // All proposals for this project
        proposalsCount: allProposals.length,
        originalTimeline: serviceRequest?.timeline || null,
        providerProposedTimeline: acceptedProposal?.deliveryTime || null,
        serviceRequestId: serviceRequest?.id || null,
      };
    }

    // If not found as Project, try as ServiceRequest
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: projectId },
      include: {
        customer: {
          include: {
            customerProfile: true,
          },
        },
        proposals: {
          select: {
            id: true,
            bidAmount: true,
            deliveryTime: true,
            coverLetter: true,
            attachmentUrls: true,
            status: true,
            createdAt: true,
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
                    profileImageUrl: true,
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
          orderBy: {
            createdAt: "desc",
          },
        },
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!serviceRequest) {
      return null;
    }

    // Transform ServiceRequest to match Project structure
    return {
      id: serviceRequest.id,
      title: serviceRequest.title,
      description: serviceRequest.description,
      category: serviceRequest.category,
      budgetMin: serviceRequest.budgetMin,
      budgetMax: serviceRequest.budgetMax,
      skills: serviceRequest.skills,
      timeline: serviceRequest.timeline,
      priority: serviceRequest.priority,
      ndaSigned: serviceRequest.ndaSigned,
      requirements: serviceRequest.requirements,
      deliverables: serviceRequest.deliverables,
      status: "OPEN", // ServiceRequests are always OPEN
      customer: serviceRequest.customer,
      provider: null, // No provider yet
      milestones: serviceRequest.milestones || [],
      Dispute: [], // ServiceRequests can't have disputes
      proposals: serviceRequest.proposals || [],
      proposalsCount: serviceRequest.proposals?.length || 0,
      createdAt: serviceRequest.createdAt,
      updatedAt: serviceRequest.updatedAt,
      type: "serviceRequest", // Mark as ServiceRequest
      proposal: null, // No accepted proposal yet
      originalTimeline: serviceRequest.timeline,
      providerProposedTimeline: null,
      serviceRequestId: serviceRequest.id,
    };
  },

  async updateProject(projectId, updateData) {
    // Try to find as Project first
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (existingProject) {
      // Update Project
      const project = await prisma.project.update({
        where: { id: projectId },
        data: updateData,
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
          milestones: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });

      // Auto-resolve any UNDER_REVIEW disputes if project is completed
      if (updateData.status === "COMPLETED") {
        try {
          const { disputeService } = await import("../../disputes/service.js");
          await disputeService.autoResolveDisputeOnProjectCompletion(projectId);
        } catch (error) {
          console.error("Error auto-resolving dispute:", error);
          // Don't fail the update if dispute resolution fails
        }
      }

      return {
        ...project,
        type: "project",
      };
    }

    // If not found as Project, try as ServiceRequest
    const existingServiceRequest = await prisma.serviceRequest.findUnique({
      where: { id: projectId },
    });

    if (existingServiceRequest) {
      // Remove status from updateData for ServiceRequests (status is always OPEN)
      const { status, ...serviceRequestUpdateData } = updateData;

      const serviceRequest = await prisma.serviceRequest.update({
        where: { id: projectId },
        data: serviceRequestUpdateData,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          proposals: {
            select: {
              id: true,
              status: true,
              provider: {
                select: {
                  id: true,
                  name: true,
                  email: true,
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

      // Transform to match Project structure
      return {
        id: serviceRequest.id,
        title: serviceRequest.title,
        description: serviceRequest.description,
        category: serviceRequest.category,
        budgetMin: serviceRequest.budgetMin,
        budgetMax: serviceRequest.budgetMax,
        skills: serviceRequest.skills,
        timeline: serviceRequest.timeline,
        priority: serviceRequest.priority,
        ndaSigned: serviceRequest.ndaSigned,
        requirements: serviceRequest.requirements,
        deliverables: serviceRequest.deliverables,
        status: "OPEN", // ServiceRequests are always OPEN
        customer: serviceRequest.customer,
        provider: null,
        milestones: serviceRequest.milestones || [],
        Dispute: [],
        proposals: serviceRequest.proposals || [],
        proposalsCount: serviceRequest.proposals?.length || 0,
        createdAt: serviceRequest.createdAt,
        updatedAt: serviceRequest.updatedAt,
        type: "serviceRequest",
      };
    }

    throw new Error("Project or ServiceRequest not found");
  },

  async getProjectStats() {
    const [totalProjects, inProgress, completed, disputed, openServiceRequests] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: "IN_PROGRESS" } }),
      prisma.project.count({ where: { status: "COMPLETED" } }),
      prisma.project.count({ where: { status: "DISPUTED" } }),
      prisma.serviceRequest.count({ where: { status: "OPEN" } }),
    ]);

    const [projects, serviceRequests] = await Promise.all([
      prisma.project.findMany({
        select: {
          budgetMin: true,
          budgetMax: true,
        },
      }),
      prisma.serviceRequest.findMany({
        where: { status: "OPEN" },
        select: {
          budgetMin: true,
          budgetMax: true,
        },
      }),
    ]);

    const projectsValue = projects.reduce((sum, p) => {
      return sum + (p.budgetMax || p.budgetMin || 0);
    }, 0);

    const serviceRequestsValue = serviceRequests.reduce((sum, sr) => {
      return sum + (sr.budgetMax || sr.budgetMin || 0);
    }, 0);

    const totalValue = projectsValue + serviceRequestsValue;
    const totalItems = totalProjects + openServiceRequests;

    return {
      totalProjects: totalItems, // Total includes both Projects and ServiceRequests
      activeProjects: inProgress,
      completedProjects: completed,
      disputedProjects: disputed,
      openOpportunities: openServiceRequests, // Unmatched ServiceRequests
      totalValue,
    };
  },
};

export default prisma;

