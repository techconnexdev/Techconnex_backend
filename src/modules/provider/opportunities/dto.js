// src/modules/provider/opportunities/dto.js
export class GetOpportunitiesDto {
  constructor(data) {
    this.providerId = data.providerId;
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 10;
    this.category = data.category;
    this.skills = data.skills ? data.skills.split(',').map(s => s.trim()) : [];
    this.search = data.search;
  }

  validate() {
    if (!this.providerId) {
      throw new Error("Provider ID is required");
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
