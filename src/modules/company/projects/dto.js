// src/modules/company/projects/dto.js

// Helper to ensure markdown string (accepts string, array, or null)
const ensureMarkdownString = (v) => {
  if (v == null || v === "") return undefined;
  if (typeof v === "string") {
    return v.trim() || undefined;
  }
  // Backward compatibility: convert array to markdown (one item per line with bullet)
  if (Array.isArray(v)) {
    const items = v.map(String).map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return undefined;
    // Convert array to markdown list
    return items.map(item => `- ${item}`).join('\n');
  }
  return undefined;
};


export class CreateProjectDto {
  constructor(data) {
    this.title = data.title;
    this.description = data.description;
    // Category is now a string, no need to map
    this.category = data.category || "";
    this.budgetMin = data.budgetMin;
    this.budgetMax = data.budgetMax;
    this.skills = data.skills || [];
    
    // Support both old format (timeline string) and new format (timelineAmount + timelineUnit or timelineInDays)
    if (data.timeline) {
      // Already has timeline string (backward compatibility)
      this.timeline = data.timeline;
      this.timelineInDays = data.timelineInDays || null;
    } else if (data.timelineAmount && data.timelineUnit) {
      // Build timeline from amount and unit
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
      const plural = amount > 1 ? "s" : "";
      this.timeline = `${amount} ${data.timelineUnit}${plural}`;
      this.timelineInDays = days;
    } else if (data.timelineInDays) {
      // Only timelineInDays provided, estimate timeline string
      this.timelineInDays = Number(data.timelineInDays);
      this.timeline = data.timeline || `${this.timelineInDays} day${this.timelineInDays > 1 ? "s" : ""}`;
    } else {
      this.timeline = data.timeline || null;
      this.timelineInDays = data.timelineInDays || null;
    }
    
    this.priority = data.priority;
    this.ndaSigned = data.ndaSigned || false;
    this.requirements = ensureMarkdownString(data.requirements);   // Markdown string
    this.deliverables = ensureMarkdownString(data.deliverables);   // Markdown string
    this.customerId = data.customerId;
  }

  // mapCategory method removed - categories are now strings, no mapping needed

  validate() {
    // existing checks...
    if (!this.title || this.title.trim() === "") throw new Error("Title is required");
    if (!this.description || this.description.trim() === "") throw new Error("Description is required");
    if (!this.category || this.category.trim() === "") throw new Error("Category is required");
    if (!this.budgetMin || !this.budgetMax) throw new Error("Budget range is required");
    if (this.budgetMin >= this.budgetMax) throw new Error("Minimum budget must be less than maximum budget");
    if (!this.customerId) throw new Error("Customer ID is required");

    // Requirements and deliverables are now optional markdown strings
    if (this.requirements !== undefined && typeof this.requirements !== "string") {
      throw new Error("Requirements must be a markdown string");
    }
    if (this.deliverables !== undefined && typeof this.deliverables !== "string") {
      throw new Error("Deliverables must be a markdown string");
    }
  }
}

export class GetProjectsDto {
  constructor(data) {
    this.customerId = data.customerId;
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 10;
    this.status = data.status;
    this.category = data.category;
  }

  validate() {
    if (!this.customerId) {
      throw new Error("Customer ID is required");
    }
    
    // Validate status if provided
    if (this.status) {
      const validStatuses = [
        "OPEN", "CLOSED", // ServiceRequest statuses
        "IN_PROGRESS", "COMPLETED", "DISPUTED", "CANCELLED" // Project statuses
      ];
      if (!validStatuses.includes(this.status)) {
        throw new Error("Invalid status filter");
      }
    }
    
    // Validate pagination
    if (this.page < 1) {
      throw new Error("Page must be greater than 0");
    }
    if (this.limit < 1 || this.limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }
  }
}

// Helper to ensure markdown string for updates (accepts string, array, or null)
const ensureMarkdownStringForUpdate = (v) => {
  if (v == null || v === "") return undefined;
  if (typeof v === "string") {
    return v.trim() || undefined;
  }
  // Backward compatibility: convert array to markdown (one item per line with bullet)
  if (Array.isArray(v)) {
    const items = v.map(String).map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return undefined;
    // Convert array to markdown list
    return items.map(item => `- ${item}`).join('\n');
  }
  return undefined;
};

export class UpdateProjectDto {
  constructor(data) {
    this.customerId   = data.customerId;
    this.title        = data.title;
    this.description  = data.description;
    // Category is now a string, accept it as-is
    this.category     = data.category;
    this.budgetMin    = data.budgetMin;
    this.budgetMax    = data.budgetMax;
    
    // Support both old format (timeline string) and new format (timelineAmount + timelineUnit or timelineInDays)
    if (data.timeline) {
      // Already has timeline string (backward compatibility)
      this.timeline = data.timeline;
      this.timelineInDays = data.timelineInDays || undefined;
    } else if (data.timelineAmount && data.timelineUnit) {
      // Build timeline from amount and unit
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
      const plural = amount > 1 ? "s" : "";
      this.timeline = `${amount} ${data.timelineUnit}${plural}`;
      this.timelineInDays = days;
    } else if (data.timelineInDays) {
      // Only timelineInDays provided, estimate timeline string
      this.timelineInDays = Number(data.timelineInDays);
      this.timeline = data.timeline || `${this.timelineInDays} day${this.timelineInDays > 1 ? "s" : ""}`;
    } else {
      this.timeline = data.timeline;
      this.timelineInDays = data.timelineInDays;
    }
    
    this.priority     = data.priority;
    this.skills       = Array.isArray(data.skills) ? data.skills : undefined;
    this.ndaSigned    = typeof data.ndaSigned === "boolean" ? data.ndaSigned : undefined;
    this.requirements = ensureMarkdownStringForUpdate(data.requirements);
    this.deliverables = ensureMarkdownStringForUpdate(data.deliverables);
  }
  validatePartial() {
    if (!this.customerId) throw new Error("Unauthorized");
    if (this.budgetMin != null && this.budgetMax != null && Number(this.budgetMin) >= Number(this.budgetMax)) {
      throw new Error("Minimum budget must be less than maximum budget");
    }
  }
}
