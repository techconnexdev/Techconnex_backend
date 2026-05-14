import { createNotification } from "../notifications/service.js";

function projectTitle(dispute) {
  return dispute?.project?.title || "your project";
}

function customerLink(projectId) {
  return `/customer/projects/${projectId}`;
}

function providerLink(projectId) {
  return `/provider/projects/${projectId}`;
}

/**
 * Other party (not the person who raised the dispute) when a new dispute is filed.
 */
export async function notifyDisputeCreated(dispute) {
  if (!dispute?.project?.customerId || !dispute?.project?.providerId) return;
  const customerId = dispute.project.customerId;
  const providerId = dispute.project.providerId;
  const otherId =
    dispute.raisedById === customerId ? providerId : customerId;
  const raisedName = dispute.raisedBy?.name || "The other party";
  const pid = dispute.projectId;
  const title = projectTitle(dispute);
  await createNotification({
    userId: otherId,
    title: "Dispute opened",
    type: "dispute",
    content: `${raisedName} opened a dispute on "${title}". Reason: ${dispute.reason || "—"}.`,
    metadata: {
      disputeId: dispute.id,
      projectId: pid,
      projectTitle: title,
      eventType: "dispute_created",
      linkPath: otherId === customerId ? customerLink(pid) : providerLink(pid),
    },
  });
}

/**
 * Notify the other party when one participant updates the dispute (details, attachments, notes).
 */
export async function notifyDisputeUpdatedByUser(dispute, updatedByUserId) {
  if (!dispute?.project?.customerId || !dispute?.project?.providerId) return;
  const customerId = dispute.project.customerId;
  const providerId = dispute.project.providerId;
  if (updatedByUserId !== customerId && updatedByUserId !== providerId) return;
  const otherId = updatedByUserId === customerId ? providerId : customerId;
  const pid = dispute.projectId;
  const title = projectTitle(dispute);
  await createNotification({
    userId: otherId,
    title: "Dispute updated",
    type: "dispute",
    content: `The dispute on "${title}" was updated with new information or attachments. Current status: ${dispute.status}.`,
    metadata: {
      disputeId: dispute.id,
      projectId: pid,
      projectTitle: title,
      eventType: "dispute_updated",
      linkPath: otherId === customerId ? customerLink(pid) : providerLink(pid),
    },
  });
}

const ADMIN_STATUS_TITLES = {
  RESOLVED: "Dispute resolved",
  REJECTED: "Dispute decision",
  CLOSED: "Dispute closed",
  UNDER_REVIEW: "Dispute under review",
  OPEN: "Dispute status updated",
};

/**
 * Notify customer and provider when an admin changes dispute status or completes payout / redo.
 */
export async function notifyDisputeAdminDecision(
  dispute,
  previousStatus,
  newStatus,
  resolutionText = null
) {
  if (!dispute?.project?.customerId || !dispute?.project?.providerId) return;
  if (previousStatus === newStatus) return;

  const pid = dispute.projectId;
  const title = projectTitle(dispute);
  const headline = ADMIN_STATUS_TITLES[newStatus] || "Dispute status update";
  const resolutionBit =
    resolutionText && String(resolutionText).trim()
      ? ` ${String(resolutionText).trim().slice(0, 280)}${String(resolutionText).length > 280 ? "…" : ""}`
      : "";

  const content = `An admin updated the dispute on "${title}" from ${previousStatus} to ${newStatus}.${resolutionBit}`;

  const baseMeta = {
    disputeId: dispute.id,
    projectId: pid,
    projectTitle: title,
    eventType: "dispute_admin_decision",
    previousStatus,
    newStatus,
  };

  await createNotification({
    userId: dispute.project.customerId,
    title: headline,
    type: "dispute",
    content,
    metadata: { ...baseMeta, linkPath: customerLink(pid) },
  });

  await createNotification({
    userId: dispute.project.providerId,
    title: headline,
    type: "dispute",
    content,
    metadata: { ...baseMeta, linkPath: providerLink(pid) },
  });
}

/**
 * When project completes and an UNDER_REVIEW dispute is auto-resolved.
 */
export async function notifyDisputeAutoResolved(dispute) {
  if (!dispute?.project?.customerId || !dispute?.project?.providerId) return;
  const pid = dispute.projectId;
  const title = projectTitle(dispute);
  const content = `The dispute on "${title}" was automatically marked resolved because the project was completed.`;

  const baseMeta = {
    disputeId: dispute.id,
    projectId: pid,
    projectTitle: title,
    eventType: "dispute_auto_resolved",
    newStatus: "RESOLVED",
  };

  await createNotification({
    userId: dispute.project.customerId,
    title: "Dispute auto-resolved",
    type: "dispute",
    content,
    metadata: { ...baseMeta, linkPath: customerLink(pid) },
  });

  await createNotification({
    userId: dispute.project.providerId,
    title: "Dispute auto-resolved",
    type: "dispute",
    content,
    metadata: { ...baseMeta, linkPath: providerLink(pid) },
  });
}
