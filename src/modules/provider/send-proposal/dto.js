// src/modules/provider/send-proposal/dto.js
export class SendProposalDto {
  constructor(data) {
    this.providerId = data.providerId;
    this.serviceRequestId = data.serviceRequestId;
    this.bidAmount = Number(data.bidAmount);
    this.bidAmountProject = Number(
      data.bidAmountProject != null ? data.bidAmountProject : NaN,
    );
    
    // Support both old format (deliveryTime) and new format (timelineAmount + timelineUnit or timelineInDays)
    if (data.timelineInDays !== undefined) {
      this.deliveryTime = Number(data.timelineInDays);
      this.timeline = data.timeline || this.buildTimelineString(data.timelineAmount, data.timelineUnit);
    } else if (data.timelineAmount && data.timelineUnit) {
      // Calculate days from amount and unit
      const amount = Number(data.timelineAmount);
      let days = 0;
      switch (data.timelineUnit) {
        case "day":
          days = amount;
          break;
        case "week":
          days = amount * 7;
          break;
        case "month":
          days = amount * 30; // Approximate: 30 days per month
          break;
      }
      this.deliveryTime = days;
      this.timeline = data.timeline || this.buildTimelineString(data.timelineAmount, data.timelineUnit);
    } else {
      // Fallback to old format
      this.deliveryTime = Number(data.deliveryTime);
      this.timeline = data.timeline || null;
    }
    
    this.coverLetter = (data.coverLetter || "").toString();
    // map uploaded files -> relative URLs
    // if controller passes req.files, we collect their paths
    this.attachmentUrls = Array.isArray(data.attachmentUrls)
      ? data.attachmentUrls
      : [];
    this.milestones = Array.isArray(data.milestones) ? data.milestones.map((m, i) => ({
      sequence: Number(m.sequence ?? i + 1),
      title: (m.title || "").toString().trim(),
      description: (m.description || "").toString(),
      amount: Number(m.amount),
      amountProject: Number(
        m.amountProject != null ? m.amountProject : NaN,
      ),
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : null,
      daysFromStart: m.daysFromStart != null ? Number(m.daysFromStart) : null,
    })) : [];
  }

  buildTimelineString(amount, unit) {
    if (!amount || !unit) return null;
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return null;
    const plural = num > 1 ? "s" : "";
    return `${num} ${unit}${plural}`;
  }

  validate() {
    if (!this.providerId) throw new Error("Provider ID is required");
    if (!this.serviceRequestId) throw new Error("ServiceRequest ID is required");
    if (typeof this.serviceRequestId !== "string" || !this.isValidUUID(this.serviceRequestId)) {
      throw new Error("ServiceRequest ID must be a valid UUID string");
    }
    if (!this.bidAmount || this.bidAmount <= 0) throw new Error("Valid bid amount is required");
    if (!this.deliveryTime || this.deliveryTime <= 0) throw new Error("Valid delivery time is required");
    if (!this.coverLetter || this.coverLetter.trim() === "") throw new Error("Cover letter is required");
    if (this.attachmentUrls.length > 3) {
      throw new Error("Maximum 3 attachments allowed");
    }

    // Milestones are REQUIRED
    if (!Array.isArray(this.milestones) || this.milestones.length === 0) {
      throw new Error("At least one milestone is required");
    }

    // Tolerance ±2% or 1 unit, whichever is larger
    const hasProjectBasis =
      Number.isFinite(this.bidAmountProject) &&
      this.bidAmountProject > 0 &&
      this.milestones.some((m) => Number.isFinite(m.amountProject));
    const total = this.milestones.reduce((s, m) => {
      const value = hasProjectBasis
        ? Number(m.amountProject)
        : Number(m.amount);
      return s + (Number.isFinite(value) ? value : 0);
    }, 0);
    const bidBase = hasProjectBasis ? this.bidAmountProject : this.bidAmount;
    const tolerance = hasProjectBasis ? 0.01 : Math.max(this.bidAmount * 0.02, 1);
    if (Math.abs(total - bidBase) > tolerance) {
      throw new Error("Total milestone amount must match your bid amount");
    }
    let prev = 0;
    const deliveryTimeDays = Number(this.deliveryTime) || 0;

    for (const m of this.milestones) {
      if (!m.title || !m.amount) throw new Error("Each milestone must have title and amount");
      if (m.sequence <= prev) throw new Error("Milestones must have increasing sequence numbers starting at 1");

      // Milestones use "days after project start" (daysFromStart) — required and validated against delivery timeline
      const days = m.daysFromStart != null ? Number(m.daysFromStart) : null;
      if (days == null || !Number.isInteger(days) || days < 1) {
        throw new Error(`Milestone "${m.title}": Days from project start is required and must be a positive integer (e.g. 7 for "7 days after start").`);
      }
      if (deliveryTimeDays > 0 && days > deliveryTimeDays) {
        throw new Error(
          `Milestone "${m.title}": Days from start (${days}) cannot exceed your delivery timeline (${deliveryTimeDays} days). ` +
          "Keep milestone days within your proposed delivery timeline."
        );
      }

      prev = m.sequence;
    }

    // Total of milestone durations must equal delivery timeline (same idea as bid amount vs milestones total)
    const sorted = [...this.milestones].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    const lastDaysFromStart = sorted.length > 0 && sorted[sorted.length - 1].daysFromStart != null
      ? Number(sorted[sorted.length - 1].daysFromStart)
      : 0;
    if (deliveryTimeDays > 0 && lastDaysFromStart !== deliveryTimeDays) {
      throw new Error(
        `Total of milestone durations must equal your delivery timeline (${deliveryTimeDays} days). ` +
        `Currently last milestone ends at day ${lastDaysFromStart}.`
      );
    }
  }
  // ...


  

  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

export class GetProposalsDto {
  constructor(data) {
    this.providerId = data.providerId;
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 10;
    this.status = data.status;
    this.serviceRequestId = data.serviceRequestId; // NEW
  }
  validate() {
    if (!this.providerId) throw new Error("Provider ID is required");
  }
}
