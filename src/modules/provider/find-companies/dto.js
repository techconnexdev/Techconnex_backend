// src/modules/provider/find-companies/dto.js

export class FindCompaniesDto {
  constructor(data) {
    this.search = data.search || "";
    this.industry = data.industry || "all";
    this.location = data.location || "all";
    this.rating = data.rating || "all";
    this.sortBy = data.sortBy || "rating";
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 20;
    this.companySize = data.companySize || "all";
    // Handle verified filter: "true" for verified, "false" for unverified, undefined for all
    if (data.verified === "true") {
      this.verified = true;
    } else if (data.verified === "false") {
      this.verified = false; // Explicitly unverified
    } else {
      this.verified = undefined; // All companies
    }
    this.userId = data.userId || null; // For checking saved status
  }

  validate() {
    if (this.page < 1) {
      throw new Error("Page must be greater than 0");
    }
    if (this.limit < 1 || this.limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }
    return true;
  }
}

export class SaveCompanyDto {
  constructor(data) {
    this.userId = data.userId;
    this.companyId = data.companyId;
  }

  validate() {
    if (!this.userId) {
      throw new Error("User ID is required");
    }
    if (!this.companyId) {
      throw new Error("Company ID is required");
    }
    return true;
  }
}

export class CompanyDetailDto {
  constructor(data) {
    this.companyId = data.companyId || data.id;
    this.userId = data.userId; // For checking if saved
  }

  validate() {
    if (!this.companyId) {
      throw new Error("Company ID is required");
    }
    return true;
  }
}

