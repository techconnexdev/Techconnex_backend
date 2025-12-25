// src/modules/company/find-providers/dto.js

export class FindProvidersDto {
  constructor(data) {
    this.search = data.search || "";
    this.category = data.category || "all";
    this.location = data.location || "all";
    this.rating = data.rating || "all";
    this.sortBy = data.sortBy || "rating";
    this.page = parseInt(data.page) || 1;
    this.limit = parseInt(data.limit) || 20;
    this.minRate = parseFloat(data.minRate) || 0;
    this.maxRate = parseFloat(data.maxRate) || 10000;
    this.skills = Array.isArray(data.skills) ? data.skills : [];
    this.availability = data.availability || "all";
    // Handle verified filter: "true" for verified, "false" for unverified, undefined for all
    if (data.verified === "true") {
      this.verified = true;
    } else if (data.verified === "false") {
      this.verified = false; // Explicitly unverified
    } else {
      this.verified = undefined; // All providers
    }
    this.topRated = data.topRated === "true";
    this.userId = data.userId || null; // For checking saved status
  }

  validate() {
    if (this.page < 1) {
      throw new Error("Page must be greater than 0");
    }
    if (this.limit < 1 || this.limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }
    if (this.minRate < 0 || this.maxRate < 0) {
      throw new Error("Rate values must be positive");
    }
    if (this.minRate > this.maxRate) {
      throw new Error("Minimum rate cannot be greater than maximum rate");
    }
    return true;
  }
}

export class SaveProviderDto {
  constructor(data) {
    this.userId = data.userId;
    this.providerId = data.providerId;
  }

  validate() {
    if (!this.userId) {
      throw new Error("User ID is required");
    }
    if (!this.providerId) {
      throw new Error("Provider ID is required");
    }
    return true;
  }
}

export class ProviderDetailDto {
  constructor(data) {
    this.providerId = data.providerId || data.id;
    this.userId = data.userId; // For checking if saved
  }

  validate() {
    if (!this.providerId) {
      throw new Error("Provider ID is required");
    }
    return true;
  }
}