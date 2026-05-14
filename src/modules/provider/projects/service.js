// src/modules/provider/projects/service.js
import { prisma } from "./model.js";
import { getTotalEarnings } from "../billing/model.js";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  GetProviderProjectsDto,
  UpdateProjectStatusDto,
  UpdateMilestoneStatusDto,
} from "./dto.js";
import { createNotification } from "../../notifications/service.js";
import { buildBudgetDisplayData } from "../../fx/service.js";

function cleanPlainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__|\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get all projects for a provider
 */
export async function getProviderProjects(dto) {
  try {
    const where = {
      providerId: dto.providerId,
    };

    // Apply filters
    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: "insensitive" } },
        { description: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    const skip = (dto.page - 1) * dto.limit;

    const [projects, total, settings] = await Promise.all([
      prisma.project.findMany({
        where,
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
              milestones: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: dto.limit,
      }),
      prisma.project.count({ where }),
      prisma.settings.findUnique({
        where: { userId: dto.providerId },
        select: { preferredCurrency: true },
      }),
    ]);
    const preferredCurrency = settings?.preferredCurrency || "MYR";

    // Calculate progress, approved price, and next milestone for each project
    const projectsWithProgress = projects.map((project) => {
      const totalMilestones = project._count.milestones;
      const completedMilestones = project.milestones.filter(
        (m) => m.status === "APPROVED" || m.status === "PAID"
      ).length;
      const progress =
        totalMilestones > 0
          ? Math.round((completedMilestones / totalMilestones) * 100)
          : 0;

      // Calculate approved price (sum of all milestone amounts)
      const approvedPrice = project.milestones.reduce(
        (sum, m) => sum + (m.amount || 0),
        0
      );

      // Find next milestone that needs work (LOCKED or IN_PROGRESS, ordered by order field)
      const nextMilestone = project.milestones.find(
        (m) => m.status === "LOCKED" || m.status === "IN_PROGRESS"
      );

      return {
        ...project,
        ...buildBudgetDisplayData(project, preferredCurrency),
        progress,
        completedMilestones,
        totalMilestones,
        approvedPrice,
        nextMilestone: nextMilestone
          ? {
              id: nextMilestone.id,
              title: nextMilestone.title,
              status: nextMilestone.status,
              order: nextMilestone.order,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / dto.limit);

    return {
      projects: projectsWithProgress,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Error fetching provider projects:", error);
    throw new Error("Failed to fetch projects");
  }
}

/**
 * Get a single project by ID for a provider
 */
export async function getProviderProjectById(projectId, providerId) {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        providerId: providerId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            customerProfile: {
              select: {
                companySize: true,
                industry: true,
                location: true,
                website: true,
                description: true,
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
        reviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                name: true,
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
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
            receiver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10, // Latest 10 messages
        },
      },
    });

    if (!project) {
      throw new Error(
        "Project not found or you don't have permission to access it"
      );
    }
    const settings = await prisma.settings.findUnique({
      where: { userId: providerId },
      select: { preferredCurrency: true },
    });
    const preferredCurrency = settings?.preferredCurrency || "MYR";

    // Find the ServiceRequest that created this Project to get the proposal and original timeline
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        projectId: project.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        requirements: true,
        deliverables: true,
        skills: true,
        timeline: true, // Original company timeline
        acceptedProposalId: true,
      },
    });

    // Find the proposal that was accepted to create this project
    let proposal = null;
    if (serviceRequest?.acceptedProposalId) {
      proposal = await prisma.proposal.findFirst({
        where: {
          id: serviceRequest.acceptedProposalId,
          providerId: providerId, // Ensure it's the provider's proposal
        },
        select: {
          id: true,
          bidAmount: true,
          attachmentUrls: true,
          createdAt: true, // Use createdAt instead of submittedAt
          deliveryTime: true, // Provider's proposed timeline in days
        },
      });
    }

    // Calculate progress
    const totalMilestones = project.milestones.length;
    const completedMilestones = project.milestones.filter(
      (m) => m.status === "APPROVED" || m.status === "PAID"
    ).length;
    const progress =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    // Calculate approved price (sum of all milestone amounts)
    const approvedPrice = project.milestones.reduce(
      (sum, m) => sum + (m.amount || 0),
      0
    );

    return {
      ...project,
      ...buildBudgetDisplayData(project, preferredCurrency),
      progress,
      completedMilestones,
      totalMilestones,
      approvedPrice,
      serviceRequestId: serviceRequest?.id || null,
      serviceRequestTitle: serviceRequest?.title || null,
      serviceRequestDescription: serviceRequest?.description || null,
      serviceRequestRequirements: serviceRequest?.requirements || null,
      serviceRequestDeliverables: serviceRequest?.deliverables || null,
      serviceRequestSkills: serviceRequest?.skills || [],
      proposal: proposal, // Include proposal with attachments
      bidAmount: proposal?.bidAmount ?? null, // Accepted proposal bid (project currency)
      originalTimeline: serviceRequest?.timeline || null, // Original company timeline (string)
      providerProposedTimeline: proposal?.deliveryTime || null, // Provider's proposed timeline in days (number, frontend will format)
    };
  } catch (error) {
    console.error("Error fetching provider project:", error);
    throw error;
  }
}

/**
 * Update project status (provider can update to COMPLETED or DISPUTED)
 */
export async function updateProjectStatus(dto) {
  try {
    // Verify project belongs to provider
    const project = await prisma.project.findFirst({
      where: {
        id: dto.projectId,
        providerId: dto.providerId,
      },
    });

    if (!project) {
      throw new Error(
        "Project not found or you don't have permission to update it"
      );
    }

    // Update project status
    const updatedProject = await prisma.project.update({
      where: { id: dto.projectId },
      data: { status: dto.status },
      include: {
        customer: {
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
    if (dto.status === "COMPLETED") {
      try {
        const { disputeService } = await import("../../disputes/service.js");
        await disputeService.autoResolveDisputeOnProjectCompletion(
          dto.projectId
        );
      } catch (error) {
        console.error("Error auto-resolving dispute:", error);
        // Don't fail the update if dispute resolution fails
      }
    }

    // Create notification for customer
    try {
      await createNotification({
        userId: project.customerId,
        title: "Project Status Updated",
        type: "project",
        content: `Project "${project.title}" status has been updated to ${dto.status}`,
        metadata: {
          projectId: dto.projectId,
          projectTitle: project.title,
          newStatus: dto.status,
          eventType: "project_status_updated",
          linkPath: `/customer/projects/${dto.projectId}`,
        },
      });
    } catch (notificationError) {
      console.error(
        "Failed to notify customer of project status update:",
        notificationError
      );
    }

    return updatedProject;
  } catch (error) {
    console.error("Error updating project status:", error);
    throw error;
  }
}

/**
 * Update milestone status (provider can submit milestones)
 */
export async function updateMilestoneStatus(dto) {
  try {
    // Verify milestone belongs to provider's project
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: dto.milestoneId,
        project: {
          providerId: dto.providerId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            customerId: true,
          },
        },
      },
    });

    if (!milestone) {
      throw new Error(
        "Milestone not found or you don't have permission to update it"
      );
    }

    // Prepare update data
    const updateData = {
      status: dto.status,
      submittedAt: dto.status === "SUBMITTED" ? new Date() : null,
    };

    // Save deliverables to appropriate field based on status transition
    if (dto.status === "IN_PROGRESS" && milestone.status === "LOCKED") {
      // Starting work - save to startDeliverables
      if (dto.deliverables) {
        updateData.startDeliverables = dto.deliverables;
      }
    } else if (
      dto.status === "SUBMITTED" &&
      milestone.status === "IN_PROGRESS"
    ) {
      // Submitting work - save to submitDeliverables
      if (dto.deliverables) {
        updateData.submitDeliverables = dto.deliverables;
      }
      // Add attachment and note when submitting (these persist even if status changes)
      if (dto.submissionAttachmentUrl) {
        updateData.submissionAttachmentUrl = dto.submissionAttachmentUrl;
      }
      if (dto.submissionNote) {
        updateData.submissionNote = dto.submissionNote;
      }
      // Note: revisionNumber is incremented when company requests changes, not when provider submits
    } else if (dto.deliverables) {
      // For other status changes, keep deliverables in legacy field for backward compatibility
      updateData.deliverables = dto.deliverables;
    }

    // Note: We don't clear submissionAttachmentUrl, submissionNote, startDeliverables, or submitDeliverables
    // once set, they persist for reference even after status changes (unless company requests changes)

    // Update milestone
    const updatedMilestone = await prisma.milestone.update({
      where: { id: dto.milestoneId },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            customer: {
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

    // Create notification for customer
    if (dto.status === "SUBMITTED") {
      try {
        await createNotification({
          userId: milestone.project.customerId,
          title: "Milestone Submitted",
          type: "milestone",
          content: `Milestone "${
            milestone.title
          }" has been submitted for review${
            dto.submissionAttachmentUrl ? " with attachment" : ""
          }`,
          metadata: {
            milestoneId: dto.milestoneId,
            milestoneTitle: milestone.title,
            projectId: milestone.project.id,
            projectTitle: milestone.project.title,
            hasAttachment: !!dto.submissionAttachmentUrl,
            eventType: "milestone_submitted",
          },
        });
      } catch (notificationError) {
        console.error(
          "Failed to notify customer of milestone submission:",
          notificationError
        );
      }
    } else if (dto.status === "IN_PROGRESS" && milestone.status === "LOCKED") {
      // Notify customer when provider starts working on a milestone
      try {
        await createNotification({
          userId: milestone.project.customerId,
          title: "Milestone Work Started",
          type: "milestone",
          content: `Provider has started working on milestone "${milestone.title}"`,
          metadata: {
            milestoneId: dto.milestoneId,
            milestoneTitle: milestone.title,
            projectId: milestone.project.id,
            projectTitle: milestone.project.title,
            eventType: "milestone_work_started",
          },
        });
      } catch (notificationError) {
        console.error(
          "Failed to notify customer of milestone work start:",
          notificationError
        );
      }
    }

    // Return milestone with all relevant fields including attachment info
    return {
      id: updatedMilestone.id,
      title: updatedMilestone.title,
      description: updatedMilestone.description,
      amount: updatedMilestone.amount,
      dueDate: updatedMilestone.dueDate,
      order: updatedMilestone.order,
      status: updatedMilestone.status,
      startDeliverables: updatedMilestone.startDeliverables,
      submitDeliverables: updatedMilestone.submitDeliverables,
      submissionAttachmentUrl: updatedMilestone.submissionAttachmentUrl,
      submissionNote: updatedMilestone.submissionNote,
      submittedAt: updatedMilestone.submittedAt,
      revisionNumber: updatedMilestone.revisionNumber,
      submissionHistory: updatedMilestone.submissionHistory,
      deliverables: updatedMilestone.deliverables,
      project: updatedMilestone.project,
    };
  } catch (error) {
    console.error("Error updating milestone status:", error);
    throw error;
  }
}

/**
 * Get project statistics for provider
 */
export async function getProviderProjectStats(providerId) {
  try {
    // Get totalProjects from database (automatically updated when proposals are accepted)
    const providerProfile = await prisma.providerProfile.findUnique({
      where: { userId: providerId },
      select: { totalProjects: true },
    });

    const totalProjects = providerProfile?.totalProjects ?? 0;

    const [
      activeProjects,
      completedProjects,
      disputedProjects,
      totalEarningsResult,
      averageRating,
    ] = await Promise.all([
      prisma.project.count({
        where: {
          providerId,
          status: "IN_PROGRESS",
        },
      }),
      prisma.project.count({
        where: {
          providerId,
          status: "COMPLETED",
        },
      }),
      prisma.project.count({
        where: {
          providerId,
          status: "DISPUTED",
        },
      }),
      // Use billing module's getTotalEarnings to get accurate total from payments
      getTotalEarnings(providerId),
      prisma.review.aggregate({
        where: {
          recipientId: providerId, // Reviews received by the provider
        },
        _avg: { rating: true },
      }),
    ]);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      disputedProjects,
      totalEarnings: totalEarningsResult || 0,
      averageRating: averageRating._avg.rating || 0,
    };
  } catch (error) {
    console.error("Error fetching provider project stats:", error);
    throw new Error("Failed to fetch project statistics");
  }
}

/**
 * Get performance metrics for provider
 * - Completion Rate: percentage of completed/paid milestones from all milestones
 * - Repeat Clients: percentage of clients who have worked with provider more than once
 * - On-time Delivery: percentage of milestones submitted before due date
 */
export async function getProviderPerformanceMetrics(providerId) {
  try {
    // Get all milestones for the provider
    const allMilestones = await prisma.milestone.findMany({
      where: {
        project: { providerId },
      },
      select: {
        id: true,
        status: true,
        dueDate: true,
        submittedAt: true,
      },
    });

    // Calculate Completion Rate: completed/paid milestones / total milestones
    const totalMilestones = allMilestones.length;
    const completedMilestones = allMilestones.filter(
      (m) => m.status === "APPROVED" || m.status === "PAID"
    ).length;
    const completionRate =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    // Calculate Repeat Clients: clients with >1 project / total unique clients
    const projects = await prisma.project.findMany({
      where: { providerId },
      select: {
        customerId: true,
      },
    });

    const uniqueClients = new Set(projects.map((p) => p.customerId));
    const totalUniqueClients = uniqueClients.size;

    // Count how many clients have more than one project
    const clientProjectCounts = {};
    projects.forEach((p) => {
      clientProjectCounts[p.customerId] =
        (clientProjectCounts[p.customerId] || 0) + 1;
    });

    const repeatClientsCount = Object.values(clientProjectCounts).filter(
      (count) => count > 1
    ).length;

    const repeatClients =
      totalUniqueClients > 0
        ? Math.round((repeatClientsCount / totalUniqueClients) * 100)
        : 0;

    // Calculate On-time Delivery: milestones submitted before due date / total submitted milestones
    const submittedMilestones = allMilestones.filter(
      (m) => m.submittedAt !== null && m.dueDate !== null
    );

    const onTimeMilestones = submittedMilestones.filter((m) => {
      const submittedDate = new Date(m.submittedAt);
      const dueDate = new Date(m.dueDate);
      return submittedDate <= dueDate;
    }).length;

    const onTimeDelivery =
      submittedMilestones.length > 0
        ? Math.round((onTimeMilestones / submittedMilestones.length) * 100)
        : 0;

    return {
      completionRate,
      repeatClients,
      onTimeDelivery,
    };
  } catch (error) {
    console.error("Error fetching provider performance metrics:", error);
    throw new Error("Failed to fetch performance metrics");
  }
}

export async function generateProjectMilestonesAiDraft(
  projectId,
  providerId,
  payload = {},
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, providerId },
    include: {
      customer: {
        select: {
          name: true,
          customerProfile: { select: { industry: true } },
        },
      },
    },
  });

  if (!project) throw new Error("Project not found");

  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: { projectId: project.id },
    select: {
      title: true,
      description: true,
      category: true,
      requirements: true,
      deliverables: true,
      skills: true,
      timeline: true,
      budgetMin: true,
      budgetMax: true,
    },
  });

  const providerProfile = await prisma.providerProfile.findUnique({
    where: { userId: providerId },
    include: { user: { select: { name: true } } },
  });
  if (!providerProfile) throw new Error("Provider profile not found");

  const bidAmount = Number(payload.bidAmount || 0);
  const timelineAmount = Number(payload.timelineAmount || 0);
  const timelineUnit = String(payload.timelineUnit || "").trim() || "day";
  const processPreference = cleanPlainText(payload.processPreference || "");

  const prompt = PromptTemplate.fromTemplate(`
You are an expert proposal assistant. Write client-facing milestone drafts in plain text.

Provider context:
- Name: {providerName}
- Role: {providerMajor}
- Bio: {providerBio}
- Skills: {providerSkills}
- Years Experience: {yearsExperience}

Project context:
- Project title: {projectTitle}
- Project description: {projectDescription}
- Category: {projectCategory}
- Requirements: {requirements}
- Deliverables: {deliverables}
- Skills Required: {projectSkills}
- Timeline: {projectTimeline}
- Budget: {budgetMin} - {budgetMax}
- Client industry: {clientIndustry}

Approved contract context:
- Bid amount (project currency): {bidAmount}
- Delivery timeline: {timelineAmount} {timelineUnit}
- Provider process preference: {processPreference}

Return ONLY valid JSON:
{{
  "milestones": [
    {{ "title": "string", "description": "string" }}
  ],
  "explanation": ["string", "string"]
}}

Rules:
- Plain text only, no markdown/HTML.
- 3-6 milestones.
- Professional natural wording.
`);

  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.35,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  const chain = RunnableSequence.from([prompt, model]);
  const result = await chain.invoke({
    providerName: providerProfile.user?.name || "Provider",
    providerMajor: providerProfile.major || "",
    providerBio: providerProfile.bio || "",
    providerSkills: (providerProfile.skills || []).slice(0, 10).join(", "),
    yearsExperience: String(providerProfile.yearsExperience || ""),
    projectTitle: project.title || serviceRequest?.title || "",
    projectDescription: project.description || serviceRequest?.description || "",
    projectCategory: project.category || serviceRequest?.category || "",
    requirements: Array.isArray(serviceRequest?.requirements)
      ? serviceRequest.requirements.join(", ")
      : String(serviceRequest?.requirements || ""),
    deliverables: Array.isArray(serviceRequest?.deliverables)
      ? serviceRequest.deliverables.join(", ")
      : String(serviceRequest?.deliverables || ""),
    projectSkills: Array.isArray(serviceRequest?.skills)
      ? serviceRequest.skills.join(", ")
      : "",
    projectTimeline: serviceRequest?.timeline || "",
    budgetMin: String(serviceRequest?.budgetMin || project.budgetMin || 0),
    budgetMax: String(serviceRequest?.budgetMax || project.budgetMax || 0),
    clientIndustry: project.customer?.customerProfile?.industry || "",
    bidAmount: String(Number.isFinite(bidAmount) ? bidAmount : 0),
    timelineAmount: String(Number.isFinite(timelineAmount) ? timelineAmount : 0),
    timelineUnit,
    processPreference,
  });

  const raw = String(result?.content || "").trim();
  const jsonCandidate = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  let parsed;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    throw new Error("AI draft response was invalid");
  }

  return {
    milestones: Array.isArray(parsed?.milestones)
      ? parsed.milestones
          .map((m) => ({
            title: cleanPlainText(m?.title),
            description: cleanPlainText(m?.description),
          }))
          .filter((m) => m.title && m.description)
          .slice(0, 6)
      : [],
    explanation: Array.isArray(parsed?.explanation)
      ? parsed.explanation
          .map((x) => cleanPlainText(x))
          .filter(Boolean)
          .slice(0, 4)
      : [],
  };
}
