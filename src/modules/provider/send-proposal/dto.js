// src/modules/provider/send-proposal/dto.js
export class SendProposalDto {
  constructor(data) {
    this.providerId = data.providerId;
    this.serviceRequestId = data.serviceRequestId;
    this.bidAmount = Number(data.bidAmount);
    
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
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : null,
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
    const total = this.milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const tolerance = Math.max(this.bidAmount * 0.02, 1); // adjust if you prefer
    if (Math.abs(total - this.bidAmount) > tolerance) {
      throw new Error("Total milestone amount must approximately match bid amount");
    }
    let prev = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    for (const m of this.milestones) {
      if (!m.title || !m.amount) throw new Error("Each milestone must have title and amount");
      if (m.sequence <= prev) throw new Error("Milestones must have increasing sequence numbers starting at 1");
      
      // Validate due date is not in the past
      if (m.dueDate) {
        const dueDate = new Date(m.dueDate);
        if (isNaN(dueDate.getTime())) {
          throw new Error(`Milestone "${m.title}": Due date must be a valid date`);
        }
        const dueDateOnly = new Date(dueDate);
        dueDateOnly.setHours(0, 0, 0, 0); // Set to start of day for comparison
        
        if (dueDateOnly < today) {
          throw new Error(`Milestone "${m.title}": Due date cannot be in the past. Please select today or a future date.`);
        }
      }
      
      prev = m.sequence;
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
