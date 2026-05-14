import { prisma } from "../../../utils/prisma.js";
export async function getAllConversationReports(filters = {}) {
  const { status, search } = filters;

  const where = {};

  if (status && status !== "all") {
    where.status = status;
  }

  if (search?.trim()) {
    where.OR = [
      {
        reporter: {
          name: { contains: search, mode: "insensitive" },
        },
      },
      {
        reporter: {
          email: { contains: search, mode: "insensitive" },
        },
      },
      {
        reported: {
          name: { contains: search, mode: "insensitive" },
        },
      },
      {
        reported: {
          email: { contains: search, mode: "insensitive" },
        },
      },
    ];
  }

  const reports = await prisma.conversationReport.findMany({
    where,
    include: {
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
      reported: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reports;
}

export async function getConversationReportById(id) {
  const report = await prisma.conversationReport.findUnique({
    where: { id },
    include: {
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
      reported: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
    },
  });
  return report;
}

export async function getMessagesBetweenReportUsers(reportId) {
  const report = await prisma.conversationReport.findUnique({
    where: { id: reportId },
    select: { reporterId: true, reportedUserId: true },
  });
  if (!report) return null;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: report.reporterId, receiverId: report.reportedUserId },
        { senderId: report.reportedUserId, receiverId: report.reporterId },
      ],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
          customerProfile: { select: { profileImageUrl: true } },
          providerProfile: { select: { profileImageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return messages;
}

export async function updateReportStatus(reportId, status) {
  const validStatuses = ["PENDING", "REVIEWED", "RESOLVED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }
  return prisma.conversationReport.update({
    where: { id: reportId },
    data: { status },
  });
}

export async function getConversationReportStats() {
  const [total, pending, reviewed] = await Promise.all([
    prisma.conversationReport.count(),
    prisma.conversationReport.count({ where: { status: "PENDING" } }),
    prisma.conversationReport.count({
      where: { status: { in: ["REVIEWED", "RESOLVED"] } },
    }),
  ]);

  return {
    total,
    pending,
    reviewed,
  };
}
