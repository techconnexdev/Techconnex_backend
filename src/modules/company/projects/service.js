// src/modules/company/projects/service.js
import { prisma } from "./model.js";
import { CreateProjectDto, GetProjectsDto } from "./dto.js";
import { createServiceRequestAiDraft } from "./service-request-ai-draft.js";
import { createNotification } from "../../notifications/service.js";

export async function createProject(dto) {
  try {
    // Create a ServiceRequest - Projects are created when proposals are accepted
    // Use transaction to ensure atomicity when updating projectsPosted
    const result = await prisma.$transaction(async (tx) => {
      // Create ServiceRequest
      const serviceRequest = await tx.serviceRequest.create({
        data: {
          title: dto.title,
          description: dto.description,
          category: dto.category,
          budgetMin: dto.budgetMin,
          budgetMax: dto.budgetMax,
          skills: dto.skills,
          timeline: dto.timeline,
          priority: dto.priority,
          ndaSigned: dto.ndaSigned || false,
          requirements: dto.requirements,
          deliverables: dto.deliverables,
          customerId: dto.customerId,
          status: "OPEN",
        },
      });

      // Increment projectsPosted in CustomerProfile
      // First, get current value to handle nulls properly
      const customerProfile = await tx.customerProfile.findUnique({
        where: { userId: dto.customerId },
        select: { projectsPosted: true },
      });

      const currentProjectsPosted = customerProfile?.projectsPosted ?? 0;

      await tx.customerProfile.upsert({
        where: { userId: dto.customerId },
        update: {
          projectsPosted: currentProjectsPosted + 1,
        },
        create: {
          userId: dto.customerId,
          projectsPosted: 1,
        },
      });

      // Return service request with all relations
      return await tx.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
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
          proposals: {
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
                      profileImageUrl: true, // 🆕 Profile image
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
    });

    // Try to generate AI draft for service request
    try {
      if (result && result.id) {
        await createServiceRequestAiDraft(result.id);
      }
    } catch (err) {
      // Log and continue — project creation should not fail because of AI draft
      console.error("Failed to create service request AI draft:", err);
    }

    return result;
  } catch (error) {
    console.error("Error creating service request:", error);
    throw new Error("Failed to create service request");
  }
}

export async function getProjects(dto) {
  try {
    const skip = (dto.page - 1) * dto.limit;

    // Build where clauses for both ServiceRequests and Projects
    const serviceRequestWhere = {
      customerId: dto.customerId,
      status: { not: "MATCHED" }, // Only get non-matched service requests
    };

    const projectWhere = {
      customerId: dto.customerId,
    };

    // Apply filters
    if (dto.status) {
      if (dto.status === "OPEN" || dto.status === "CLOSED") {
        serviceRequestWhere.status = dto.status;
      } else if (
        ["IN_PROGRESS", "COMPLETED", "DISPUTED"].includes(dto.status)
      ) {
        projectWhere.status = dto.status;
      }
    }

    if (dto.category) {
      serviceRequestWhere.category = dto.category;
      projectWhere.category = dto.category;
    }

    // Fetch ServiceRequests and Projects in parallel
    const [serviceRequests, projects, serviceRequestTotal, projectTotal] =
      await Promise.all([
        prisma.serviceRequest.findMany({
          where: serviceRequestWhere,
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
            proposals: {
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
            _count: {
              select: {
                proposals: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: dto.limit,
        }),
        prisma.project.findMany({
          where: projectWhere,
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
            _count: {
              select: {
                reviews: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: dto.limit,
        }),
        prisma.serviceRequest.count({ where: serviceRequestWhere }),
        prisma.project.count({ where: projectWhere }),
      ]);

    // Add type field and merge the results
    const serviceRequestsWithType = serviceRequests.map((item) => ({
      ...item,
      type: "ServiceRequest",
    }));

    // Calculate progress, completedMilestones, and totalMilestones for each project (like provider side)
    const projectsWithType = projects.map((item) => {
      const totalMilestones = item.milestones?.length || 0;
      const completedMilestones =
        item.milestones?.filter(
          (m) => m.status === "APPROVED" || m.status === "PAID"
        ).length || 0;
      const progress =
        totalMilestones > 0
          ? Math.round((completedMilestones / totalMilestones) * 100)
          : 0;

      // Calculate approved price (sum of all milestone amounts)
      const approvedPrice =
        item.milestones?.reduce(
          (sum, milestone) => sum + milestone.amount,
          0
        ) || 0;

      return {
        ...item,
        type: "Project",
        progress,
        completedMilestones,
        totalMilestones,
        approvedPrice,
      };
    });

    // Combine and sort by creation date
    const combinedItems = [
      ...serviceRequestsWithType,
      ...projectsWithType,
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination to combined results
    const paginatedItems = combinedItems.slice(skip, skip + dto.limit);
    const total = serviceRequestTotal + projectTotal;
    const totalPages = Math.ceil(total / dto.limit);

    return {
      items: paginatedItems,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Error fetching projects and service requests:", error);
    throw new Error("Failed to fetch projects and service requests");
  }
}

export async function getProjectById(projectId, customerId) {
  try {
    // First try to find as ServiceRequest
    let serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        id: projectId,
        customerId: customerId,
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
                website: true,
              },
            },
          },
        },
        proposals: {
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
        },
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            proposals: true,
          },
        },
      },
    });

    if (serviceRequest) {
      return {
        ...serviceRequest,
        type: "ServiceRequest",
      };
    }

    // If not found as ServiceRequest, try as Project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        customerId: customerId,
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
                website: true,
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
                bio: true,
                skills: true,
              },
            },
          },
        },
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                name: true,
                customerProfile: {
                  select: {
                    industry: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error("Project or ServiceRequest not found");
    }

    // Find the original ServiceRequest that created this Project
    const originalServiceRequest = await prisma.serviceRequest.findFirst({
      where: {
        projectId: project.id,
        customerId: customerId,
      },
      select: {
        id: true,
        timeline: true, // Original company timeline
        acceptedProposalId: true, // To get the accepted proposal
      },
    });

    // Get the accepted proposal to get provider's proposed timeline
    let acceptedProposal = null;
    if (originalServiceRequest?.acceptedProposalId) {
      acceptedProposal = await prisma.proposal.findFirst({
        where: {
          id: originalServiceRequest.acceptedProposalId,
        },
        select: {
          id: true,
          deliveryTime: true, // Provider's proposed timeline in days
        },
      });
    }

    // Calculate project stats
    const milestones = project.milestones || [];
    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter(
      (m) => m.status === "APPROVED" || m.status === "PAID"
    ).length;
    const progress =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    // Calculate approved price (sum of all milestone amounts)
    const approvedPrice = milestones.reduce(
      (sum, milestone) => sum + milestone.amount,
      0
    );

    // Calculate total spent (sum of PAID milestone amounts)
    const totalSpent = milestones
      .filter((m) => m.status !== "LOCKED")
      .reduce((sum, milestone) => sum + milestone.amount, 0);

    // Calculate days left until the last milestone due date
    let daysLeft = null;
    if (milestones.length > 0) {
      const lastMilestone = milestones[milestones.length - 1];
      if (lastMilestone.dueDate) {
        const dueDate = new Date(lastMilestone.dueDate);
        const now = new Date();
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysLeft = diffDays > 0 ? diffDays : 0;
      }
    }

    return {
      ...project,
      type: "Project",
      serviceRequestId: originalServiceRequest?.id || null, // Include the original ServiceRequest ID for fetching proposals
      originalTimeline: originalServiceRequest?.timeline || null, // Original company timeline (string)
      providerProposedTimeline: acceptedProposal?.deliveryTime || null, // Provider's proposed timeline in days (number, frontend will format)
      approvedPrice, // Sum of all milestone amounts
      totalSpent, // Sum of PAID milestone amounts
      progress, // Percentage of completed milestones
      daysLeft, // Days until last milestone due date
    };
  } catch (error) {
    console.error("Error fetching project:", error);
    throw new Error("Failed to fetch project");
  }
}

/**
 * Get project statistics for company (inspired by provider stats)
 */
export async function getCompanyProjectStats(customerId) {
  try {
    const [
      activeProjects,
      completedProjects,
      disputedProjects,
      totalSpentResult,
      reviewStats,
    ] = await Promise.all([
      prisma.project.count({
        where: {
          customerId,
          status: "IN_PROGRESS",
        },
      }),
      prisma.project.count({
        where: {
          customerId,
          status: "COMPLETED",
        },
      }),
      prisma.project.count({
        where: {
          customerId,
          status: "DISPUTED",
        },
      }),
      prisma.milestone.aggregate({
        where: {
          project: { customerId },
          status: "PAID",
        },
        _sum: { amount: true },
      }),
      Promise.all([
        prisma.review.count({
          where: {
            recipientId: customerId,
          },
        }),
        prisma.review.aggregate({
          where: {
            recipientId: customerId,
          },
          _avg: { rating: true },
        }),
      ]),
    ]);

    const [reviewCount, averageRatingResult] = reviewStats;

    return {
      activeProjects,
      completedProjects,
      disputedProjects,
      totalSpent: totalSpentResult._sum.amount || 0,
      averageRating: averageRatingResult._avg.rating || null,
      reviewCount: reviewCount || 0,
    };
  } catch (error) {
    console.error("Error fetching company project stats:", error);
    throw new Error("Failed to fetch project statistics");
  }
}

export async function updateProjectStatus(projectId, customerId, status) {
  try {
    const project = await prisma.project.update({
      where: {
        id: projectId,
        customerId: customerId,
      },
      data: {
        status: status,
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
        provider: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Auto-resolve any UNDER_REVIEW disputes if project is completed
    if (status === "COMPLETED") {
      try {
        const { disputeService } = await import("../../disputes/service.js");
        await disputeService.autoResolveDisputeOnProjectCompletion(projectId);
      } catch (error) {
        console.error("Error auto-resolving dispute:", error);
        // Don't fail the update if dispute resolution fails
      }
    }

    return project;
  } catch (error) {
    console.error("Error updating project status:", error);
    throw new Error("Failed to update project status");
  }
}

// ServiceRequest milestone management functions
export async function getServiceRequestMilestones(
  serviceRequestId,
  customerId
) {
  try {
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        id: serviceRequestId,
        customerId: customerId,
        status: "OPEN", // Only allow milestone management for OPEN requests
      },
      include: {
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!serviceRequest) {
      throw new Error("ServiceRequest not found or not in OPEN status");
    }

    return serviceRequest.milestones;
  } catch (error) {
    console.error("Error fetching service request milestones:", error);
    throw new Error("Failed to fetch service request milestones");
  }
}

export async function updateServiceRequestMilestones(
  serviceRequestId,
  customerId,
  milestones
) {
  try {
    // First verify the service request exists and is in OPEN status
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        id: serviceRequestId,
        customerId: customerId,
        status: "OPEN",
      },
    });

    if (!serviceRequest) {
      throw new Error("ServiceRequest not found or not in OPEN status");
    }

    // Validate milestone amounts are within budget range
    const totalAmount = milestones.reduce(
      (sum, milestone) => sum + milestone.amount,
      0
    );
    if (
      totalAmount < serviceRequest.budgetMin ||
      totalAmount > serviceRequest.budgetMax
    ) {
      throw new Error("Total milestone amount must be within budget range");
    }

    // Delete existing milestones and create new ones
    await prisma.$transaction(async (tx) => {
      // Delete existing milestones
      await tx.serviceRequestMilestone.deleteMany({
        where: {
          serviceRequestId: serviceRequestId,
        },
      });

      // Create new milestones
      await tx.serviceRequestMilestone.createMany({
        data: milestones.map((milestone, index) => ({
          serviceRequestId: serviceRequestId,
          title: milestone.title,
          description: milestone.description,
          amount: milestone.amount,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
          order: index + 1,
          status: "PENDING",
          source: "COMPANY",
        })),
      });
    });

    // Return updated milestones
    return await getServiceRequestMilestones(serviceRequestId, customerId);
  } catch (error) {
    console.error("Error updating service request milestones:", error);
    throw new Error("Failed to update service request milestones");
  }
}

// src/modules/company/projects/service.js
export async function updateProjectDetails(id, customerId, dto) {
  // Try updating an OPEN ServiceRequest owned by this customer
  const sr = await prisma.serviceRequest.findFirst({
    where: { id, customerId },
  });
  if (!sr) {
    // If not a ServiceRequest, optionally update a Project the customer owns:
    const pj = await prisma.project.findFirst({
      where: { id, customerId },
    });
    if (!pj) throw new Error("Not found or not authorized");
    return prisma.project.update({
      where: { id: pj.id },
      data: filterUndefined({
        title: dto.title,
        description: dto.description,
        category: dto.category,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        timeline: dto.timeline,
        priority: dto.priority,
        skills: dto.skills,
        ndaSigned: dto.ndaSigned,
        requirements: dto.requirements,
        deliverables: dto.deliverables,
      }),
    });
  }

  // ServiceRequest update
  return prisma.serviceRequest.update({
    where: { id: sr.id },
    data: filterUndefined({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      budgetMin: dto.budgetMin,
      budgetMax: dto.budgetMax,
      timeline: dto.timeline,
      priority: dto.priority,
      skills: dto.skills,
      ndaSigned: dto.ndaSigned,
      requirements: dto.requirements,
      deliverables: dto.deliverables,
    }),
  });
}

/**
 * Approve individual milestone (company can approve submitted milestones)
 */
/**
 * Request changes for a submitted milestone (reject and send back for revision)
 */
export async function requestMilestoneChanges(dto) {
  try {
    // Verify milestone belongs to company's project
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: dto.milestoneId,
        project: {
          customerId: dto.customerId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            providerId: true,
          },
        },
      },
    });

    if (!milestone) {
      throw new Error(
        "Milestone not found or you don't have permission to request changes"
      );
    }

    // Check if milestone is in SUBMITTED status
    if (milestone.status !== "SUBMITTED") {
      throw new Error(
        "Milestone must be in SUBMITTED status to request changes"
      );
    }

    // Prepare current submission to save to history
    // Revision number should represent which submission this is (1, 2, 3...)
    // Current milestone.revisionNumber is the number BEFORE this submission (0, 1, 2...)
    // So the submission number is (revisionNumber + 1)
    const currentSubmissionRevisionNumber = (milestone.revisionNumber || 0) + 1;

    const currentSubmission = {
      revisionNumber: currentSubmissionRevisionNumber, // Save as submission number (1, 2, 3...)
      submitDeliverables: milestone.submitDeliverables,
      submissionNote: milestone.submissionNote,
      submissionAttachmentUrl: milestone.submissionAttachmentUrl,
      submittedAt: milestone.submittedAt,
      requestedChangesAt: new Date(),
      requestedChangesBy: dto.customerId,
      requestedChangesReason: dto.reason || null,
    };

    // Get existing submission history
    const existingHistory = Array.isArray(milestone.submissionHistory)
      ? milestone.submissionHistory
      : [];

    // Add current submission to history
    const updatedHistory = [...existingHistory, currentSubmission];

    // Update milestone: reset status to IN_PROGRESS, save to history, increment revision
    const updatedMilestone = await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: {
        status: "IN_PROGRESS",
        revisionNumber: (milestone.revisionNumber || 0) + 1,
        submissionHistory: updatedHistory,
        // Clear current submission fields (provider will submit again)
        submitDeliverables: null,
        submissionNote: null,
        submissionAttachmentUrl: null,
        submittedAt: null,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Create notification for provider
    try {
      await createNotification({
        userId: milestone.project.providerId,
        title: "Milestone Changes Requested",
        type: "milestone",
        content: `Changes requested for milestone "${milestone.title}". Please review and resubmit.${dto.reason ? ` Reason: ${dto.reason}` : ""}`,
        metadata: {
          milestoneId: dto.milestoneId,
          milestoneTitle: milestone.title,
          projectId: milestone.project.id,
          projectTitle: milestone.project.title,
          reason: dto.reason || null,
          eventType: "milestone_changes_requested",
        },
      });
    } catch (notificationError) {
      console.error("Failed to notify provider of milestone changes request:", notificationError);
    }

    return updatedMilestone;
  } catch (error) {
    console.error("Error requesting milestone changes:", error);
    throw error;
  }
}

export async function approveIndividualMilestone(dto) {
  try {
    // Verify milestone belongs to company's project
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: dto.milestoneId,
        project: {
          customerId: dto.customerId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            providerId: true,
          },
        },
      },
    });

    if (!milestone) {
      throw new Error(
        "Milestone not found or you don't have permission to approve it"
      );
    }

    // Check if milestone is in SUBMITTED status
    if (milestone.status !== "SUBMITTED") {
      throw new Error("Milestone must be in SUBMITTED status to be approved");
    }

    // Update milestone to APPROVED status
    const updatedMilestone = await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: dto.customerId,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
    // 2️⃣ Check if *all* milestones for the project are approved
    const remainingNotApproved = await prisma.milestone.count({
      where: {
        projectId: updatedMilestone.project.id,
        NOT: { status: "APPROVED" }, // means any milestone NOT approved
      },
    });

    // If none remaining → mark project as COMPLETED
    if (remainingNotApproved === 0) {
      await prisma.project.update({
        where: { id: updatedMilestone.project.id },
        data: { status: "COMPLETED" },
      });
    }
    // Create notification for provider
    try {
      await createNotification({
        userId: milestone.project.providerId,
        title: "Milestone Approved",
        type: "milestone",
        content: `Milestone "${milestone.title}" has been approved and is ready for payment`,
        metadata: {
          milestoneId: dto.milestoneId,
          milestoneTitle: milestone.title,
          projectId: milestone.project.id,
          projectTitle: milestone.project.title,
          eventType: "milestone_approved",
        },
      });
    } catch (notificationError) {
      console.error("Failed to notify provider of milestone approval:", notificationError);
    }

    return updatedMilestone;
  } catch (error) {
    console.error("Error approving individual milestone:", error);
    throw error;
  }
}

/**
 * Mark milestone as paid (company can pay approved milestones)
 */
export async function payMilestone(dto) {
  try {
    // Verify milestone belongs to company's project
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: dto.milestoneId,
        project: {
          customerId: dto.customerId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            providerId: true,
          },
        },
      },
    });

    if (!milestone) {
      throw new Error(
        "Milestone not found or you don't have permission to pay it"
      );
    }

    // Check if milestone is in APPROVED status
    if (milestone.status !== "APPROVED") {
      throw new Error("Milestone must be in APPROVED status to be paid");
    }

    // Update milestone to PAID status
    const updatedMilestone = await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: {
        status: "PAID",
        isPaid: true,
        paidAt: new Date(),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            providerId: true,
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Create notification for provider
    await prisma.notification.create({
      data: {
        userId: milestone.project.providerId,
        type: "payment",
        title: "Payment Update",

        content: `Payment for milestone "${milestone.title}" has been processed (RM ${milestone.amount})`,
      },
    });

    // Check if all milestones are paid and update project status to COMPLETED if needed
    const projectId = updatedMilestone.project.id;
    const allMilestones = await prisma.milestone.findMany({
      where: {
        projectId: projectId,
        status: {
          notIn: ["CANCELLED", "REJECTED"], // Exclude cancelled/rejected milestones from count
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const totalMilestones = allMilestones.length;
    const paidMilestones = allMilestones.filter(
      (m) => m.status === "PAID"
    ).length;

    // If all milestones are paid and project is still IN_PROGRESS, mark it as COMPLETED
    if (
      totalMilestones > 0 &&
      paidMilestones === totalMilestones &&
      updatedMilestone.project.status === "IN_PROGRESS"
    ) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: "COMPLETED",
        },
      });

      // Auto-resolve any UNDER_REVIEW disputes for this project
      try {
        const { disputeService } = await import("../../disputes/service.js");
        await disputeService.autoResolveDisputeOnProjectCompletion(projectId);
      } catch (error) {
        console.error("Error auto-resolving dispute:", error);
        // Don't fail the payment if dispute resolution fails
      }

      // Create notification for both customer and provider
      await prisma.notification.createMany({
        data: [
          {
            userId: dto.customerId,
            type: "system",
            content: `Project "${updatedMilestone.project.title}" has been completed. All milestones have been paid.`,
          },
          {
            userId: milestone.project.providerId,
            type: "system",
            content: `Project "${updatedMilestone.project.title}" has been completed. All milestones have been paid.`,
          },
        ],
      });
    }

    return updatedMilestone;
  } catch (error) {
    console.error("Error paying milestone:", error);
    throw error;
  }
}

function filterUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}
