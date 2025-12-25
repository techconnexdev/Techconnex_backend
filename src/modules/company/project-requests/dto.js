// src/modules/company/project-requests/dto.js
export class GetProjectRequestsDto {
  constructor(data) {
    this.customerId = data.customerId;
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 10;
    this.status = data.status;
    this.category = data.category;
    this.proposalStatus = data.proposalStatus;
    this.serviceRequestId = data.serviceRequestId;
  }

  validate() {
    if (!this.customerId) {
      throw new Error("Customer ID is required");
    }
  }
}

export class AcceptProposalDto {
  constructor(data) {
    this.proposalId = data.proposalId;
    this.customerId = data.customerId;
    this.useProviderMilestones = data.useProviderMilestones !== undefined ? data.useProviderMilestones : true;
  }

  validate() {
    if (!this.proposalId) {
      throw new Error("Proposal ID is required");
    }
    if (!this.customerId) {
      throw new Error("Customer ID is required");
    }
    if (typeof this.useProviderMilestones !== 'boolean') {
      throw new Error("useProviderMilestones must be a boolean");
    }
  }
}

export class RejectProposalDto {
  constructor(data) {
    this.proposalId = data.proposalId;
    this.customerId = data.customerId;
    this.reason = data.reason;
  }

  validate() {
    if (!this.proposalId) {
      throw new Error("Proposal ID is required");
    }
    if (!this.customerId) {
      throw new Error("Customer ID is required");
    }
  }
}