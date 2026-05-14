import { prisma } from "../../utils/prisma.js";
import { buildBudgetDisplayData } from "../fx/service.js";
/**
 * Public Homepage Service
 * Serves aggregated, non-sensitive data for unauthenticated visitors.
 * Exposes: top freelancers (name, rating, totalProjects, image), top companies
 * (name, industry, employeeCount, logo), latest open service requests
 * (title, budget range, skills, category). No PII or sensitive data.
 */
const DEFAULT_LIMIT = 6;

/**
 * Top freelancers (providers) by rating and project count.
 * Public fields only: id, name, rating, totalProjects, profileImageUrl.
 */
export async function getTopFreelancers(limit = DEFAULT_LIMIT) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      providerProfile: { isNot: null },
      role: { has: "PROVIDER" },
    },
    select: {
      id: true,
      name: true,
      providerProfile: {
        select: {
          rating: true,
          totalProjects: true,
          profileImageUrl: true,
        },
      },
    },
    take: limit * 2, // fetch extra then sort and slice (Prisma can't orderBy relation fields)
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name,
    rating: u.providerProfile ? Number(u.providerProfile.rating) : 0,
    totalProjects: u.providerProfile?.totalProjects ?? 0,
    profileImageUrl: u.providerProfile?.profileImageUrl ?? null,
  }));
  mapped.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return (b.totalProjects ?? 0) - (a.totalProjects ?? 0);
  });
  return mapped.slice(0, limit);
}

/**
 * Top companies (users with customer profile) by activity.
 * Public fields only: id, name, industry, employeeCount, profileImageUrl.
 */
export async function getTopCompanies(limit = DEFAULT_LIMIT) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      customerProfile: { isNot: null },
      role: { has: "CUSTOMER" },
    },
    select: {
      id: true,
      name: true,
      customerProfile: {
        select: {
          industry: true,
          employeeCount: true,
          profileImageUrl: true,
          projectsPosted: true,
          lastActiveAt: true,
        },
      },
    },
    take: limit * 2,
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name,
    industry: u.customerProfile?.industry ?? null,
    employeeCount: u.customerProfile?.employeeCount ?? null,
    profileImageUrl: u.customerProfile?.profileImageUrl ?? null,
    _sort: {
      projectsPosted: u.customerProfile?.projectsPosted ?? 0,
      lastActiveAt: u.customerProfile?.lastActiveAt?.getTime() ?? 0,
    },
  }));
  mapped.sort((a, b) => {
    if ((b._sort.projectsPosted ?? 0) !== (a._sort.projectsPosted ?? 0))
      return (b._sort.projectsPosted ?? 0) - (a._sort.projectsPosted ?? 0);
    return (b._sort.lastActiveAt ?? 0) - (a._sort.lastActiveAt ?? 0);
  });
  return mapped.slice(0, limit).map(({ _sort, ...rest }) => rest);
}

/**
 * Latest open service requests (job listings).
 * Public fields only: id, title, budgetMin, budgetMax, skills, category, createdAt.
 */
export async function getLatestJobs(limit = DEFAULT_LIMIT) {
  const requests = await prisma.serviceRequest.findMany({
    where: { status: "OPEN" },
    select: {
      id: true,
      title: true,
      budgetMin: true,
      budgetMax: true,
      skills: true,
      category: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return requests.map((r) => ({
    id: r.id,
    title: r.title,
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    skills: r.skills ?? [],
    category: r.category,
    createdAt: r.createdAt,
  }));
}

/**
 * Single OPEN service request for public marketing pages (no auth).
 * Omits customer email. Same budget shaping as provider opportunities (MYR display default).
 */
export async function getPublicJobById(jobId) {
  if (!jobId || typeof jobId !== "string") return null;

  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: {
      id: jobId,
      status: "OPEN",
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          isVerified: true,
          customerProfile: {
            select: {
              companySize: true,
              industry: true,
              location: true,
              website: true,
              profileImageUrl: true,
              projectsPosted: true,
            },
          },
        },
      },
      milestones: {
        orderBy: { order: "asc" },
      },
      _count: {
        select: { proposals: true },
      },
    },
  });

  if (!serviceRequest) return null;

  const preferredCurrency = "MYR";
  return {
    ...serviceRequest,
    hasProposed: false,
    preferredCurrency,
    ...buildBudgetDisplayData(serviceRequest, preferredCurrency),
  };
}
