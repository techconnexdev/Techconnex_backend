// src/modules/provider/projects/dto.js

export class GetProviderProjectsDto {
  constructor(data) {
    this.providerId = data.providerId;
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 10;
    this.status = data.status;
    this.category = data.category;
    this.search = data.search;
  }

  validate() {
    const errors = [];

    if (!this.providerId) {
      errors.push("Provider ID is required");
    }

    if (this.page < 1) {
      errors.push("Page must be greater than 0");
    }

    if (this.limit < 1 || this.limit > 100) {
      errors.push("Limit must be between 1 and 100");
    }

    if (this.status && !["IN_PROGRESS", "COMPLETED", "DISPUTED"].includes(this.status)) {
      errors.push("Invalid status. Must be IN_PROGRESS, COMPLETED, or DISPUTED");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  }
}

export class UpdateProjectStatusDto {
  constructor(data) {
    this.projectId = data.projectId;
    this.providerId = data.providerId;
    this.status = data.status;
  }

  validate() {
    const errors = [];

    if (!this.projectId) {
      errors.push("Project ID is required");
    }

    if (!this.providerId) {
      errors.push("Provider ID is required");
    }

    if (!this.status) {
      errors.push("Status is required");
    }

    if (!["IN_PROGRESS", "COMPLETED", "DISPUTED"].includes(this.status)) {
      errors.push("Invalid status. Must be IN_PROGRESS, COMPLETED, or DISPUTED");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  }
}

export class UpdateMilestoneStatusDto {
  constructor(data) {
    this.milestoneId = data.milestoneId;
    this.providerId = data.providerId;
    this.status = data.status;
    this.deliverables = data.deliverables;
    this.submissionNote = data.submissionNote; // Optional note when submitting
    this.submissionAttachmentUrl = data.submissionAttachmentUrl; // Attachment file path
  }

  validate() {
    const errors = [];

    if (!this.milestoneId) {
      errors.push("Milestone ID is required");
    }

    if (!this.providerId) {
      errors.push("Provider ID is required");
    }

    if (!this.status) {
      errors.push("Status is required");
    }

    if (!["LOCKED", "IN_PROGRESS", "SUBMITTED", "CANCELLED"].includes(this.status)) {
      errors.push("Invalid status. Must be LOCKED, IN_PROGRESS, SUBMITTED, or CANCELLED");
    }

    // Note and attachment are optional, but if status is SUBMITTED, we encourage them
    // (not required, but helpful)

    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  }
}
