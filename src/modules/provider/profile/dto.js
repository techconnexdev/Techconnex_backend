class ProviderProfileDto {
  constructor(data) {
    this.bio = data.bio;
    this.major = data.major;
    this.location = data.location;
    this.hourlyRate = data.hourlyRate;
    this.availability = data.availability;
    this.languages = data.languages || [];
    this.website = data.website;
    this.portfolioLinks = data.portfolioLinks || [];
    this.profileImageUrl = data.profileImageUrl; // 🆕 Profile image
    this.skills = data.skills || [];
    this.yearsExperience = data.yearsExperience;
    this.minimumProjectBudget = data.minimumProjectBudget;
    this.maximumProjectBudget = data.maximumProjectBudget;
    this.preferredProjectDuration = data.preferredProjectDuration;
    this.workPreference = data.workPreference;
    this.teamSize = data.teamSize;
  }

  validate() {
    const errors = [];

    // Required fields validation
    if (!this.bio || this.bio.trim().length < 10) {
      errors.push("Bio must be at least 10 characters long");
    }

    if (!this.location) {
      errors.push("Location is required");
    }

    if (!this.skills || this.skills.length === 0) {
      errors.push("At least one skill is required");
    }

    // Optional field validations (normalize URLs before validation)
    if (this.website && this.website.trim()) {
      const normalizedWebsite = this.normalizeUrl(this.website);
      if (!this.isValidUrl(normalizedWebsite)) {
        errors.push("Website must be a valid URL");
      } else {
        this.website = normalizedWebsite;
      }
    } else {
      this.website = null; // Set to null if empty
    }

    // Validate portfolio links
    if (this.portfolioLinks && Array.isArray(this.portfolioLinks)) {
      const invalidLinks = [];
      this.portfolioLinks = this.portfolioLinks.map((link, index) => {
        if (link && link.trim()) {
          const normalizedLink = this.normalizeUrl(link.trim());
          if (!this.isValidUrl(normalizedLink)) {
            invalidLinks.push(`Portfolio link ${index + 1}`);
            return link; // Keep original for now
          }
          return normalizedLink;
        }
        return link;
      }).filter(Boolean); // Remove empty strings
      
      if (invalidLinks.length > 0) {
        errors.push(`${invalidLinks.join(", ")} must be valid URLs`);
      }
    }

    if (this.hourlyRate && (this.hourlyRate < 0 || this.hourlyRate > 10000)) {
      errors.push("Hourly rate must be between 0 and 10000");
    }

    if (this.yearsExperience && (this.yearsExperience < 0 || this.yearsExperience > 50)) {
      errors.push("Years of experience must be between 0 and 50");
    }

    if (this.minimumProjectBudget && this.minimumProjectBudget < 0) {
      errors.push("Minimum project budget must be positive");
    }

    if (this.maximumProjectBudget && this.maximumProjectBudget < 0) {
      errors.push("Maximum project budget must be positive");
    }

    if (this.minimumProjectBudget && this.maximumProjectBudget && 
        this.minimumProjectBudget > this.maximumProjectBudget) {
      errors.push("Minimum project budget cannot be greater than maximum project budget");
    }

    if (this.teamSize && (this.teamSize < 1 || this.teamSize > 100)) {
      errors.push("Team size must be between 1 and 100");
    }

    if (this.availability && !['available', 'busy', 'unavailable'].includes(this.availability)) {
      errors.push("Availability must be one of: available, busy, unavailable");
    }

    if (this.workPreference && !['remote', 'onsite', 'hybrid'].includes(this.workPreference)) {
      errors.push("Work preference must be one of: remote, onsite, hybrid");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  }

  validatePartial() {
    const errors = [];

    // Only validate provided fields (normalize URLs before validation)
    if (this.bio !== undefined && this.bio.trim().length < 10) {
      errors.push("Bio must be at least 10 characters long");
    }

    if (this.website !== undefined) {
      if (this.website && this.website.trim()) {
        const normalizedWebsite = this.normalizeUrl(this.website);
        if (!this.isValidUrl(normalizedWebsite)) {
          errors.push("Website must be a valid URL");
        } else {
          this.website = normalizedWebsite;
        }
      } else {
        this.website = null; // Set to null if empty
      }
    }

    // Validate portfolio links (partial)
    if (this.portfolioLinks !== undefined && Array.isArray(this.portfolioLinks)) {
      const invalidLinks = [];
      this.portfolioLinks = this.portfolioLinks.map((link, index) => {
        if (link && link.trim()) {
          const normalizedLink = this.normalizeUrl(link.trim());
          if (!this.isValidUrl(normalizedLink)) {
            invalidLinks.push(`Portfolio link ${index + 1}`);
            return link; // Keep original for now
          }
          return normalizedLink;
        }
        return link;
      }).filter(Boolean); // Remove empty strings
      
      if (invalidLinks.length > 0) {
        errors.push(`${invalidLinks.join(", ")} must be valid URLs`);
      }
    }

    if (this.hourlyRate !== undefined && (this.hourlyRate < 0 || this.hourlyRate > 10000)) {
      errors.push("Hourly rate must be between 0 and 10000");
    }

    if (this.yearsExperience !== undefined && (this.yearsExperience < 0 || this.yearsExperience > 50)) {
      errors.push("Years of experience must be between 0 and 50");
    }

    if (this.minimumProjectBudget !== undefined && this.minimumProjectBudget < 0) {
      errors.push("Minimum project budget must be positive");
    }

    if (this.maximumProjectBudget !== undefined && this.maximumProjectBudget < 0) {
      errors.push("Maximum project budget must be positive");
    }

    if (this.minimumProjectBudget && this.maximumProjectBudget && 
        this.minimumProjectBudget > this.maximumProjectBudget) {
      errors.push("Minimum project budget cannot be greater than maximum project budget");
    }

    if (this.teamSize !== undefined && (this.teamSize < 1 || this.teamSize > 100)) {
      errors.push("Team size must be between 1 and 100");
    }

    if (this.availability && !['available', 'busy', 'unavailable'].includes(this.availability)) {
      errors.push("Availability must be one of: available, busy, unavailable");
    }

    if (this.workPreference && !['remote', 'onsite', 'hybrid'].includes(this.workPreference)) {
      errors.push("Work preference must be one of: remote, onsite, hybrid");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  }

  toUpdateData() {
    // Remove portfolioUrls as it's not a direct field in Prisma
    // The portfolios relation (ProjectPortfolio[]) is separate and requires full portfolio objects
    const updateData = {
      bio: this.bio,
      major: this.major,
      location: this.location,
      hourlyRate: this.hourlyRate,
      availability: this.availability,
      languages: this.languages,
      website: this.website ? this.normalizeUrl(this.website) : this.website,
      portfolioLinks: this.portfolioLinks || [],
      profileImageUrl: this.profileImageUrl, // 🆕 Profile image (don't normalize as it's a file path, not a URL)
      skills: this.skills,
      yearsExperience: this.yearsExperience,
      minimumProjectBudget: this.minimumProjectBudget,
      maximumProjectBudget: this.maximumProjectBudget,
      preferredProjectDuration: this.preferredProjectDuration,
      workPreference: this.workPreference,
      teamSize: this.teamSize,
    };
    
    // Remove any undefined/null values to avoid Prisma errors
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });
    
    return updateData;
  }

  isValidUrl(string) {
    if (!string || typeof string !== 'string') {
      return false;
    }
    
    try {
      // Try with the URL as-is first
      new URL(string);
      return true;
    } catch (_) {
      // If it fails, try prepending https://
      try {
        new URL(`https://${string}`);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  normalizeUrl(string) {
    if (!string || typeof string !== 'string') {
      return string;
    }
    
    const trimmed = string.trim();
    if (!trimmed) {
      return trimmed;
    }
    
    // If it already has a protocol, return as-is
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    
    // Otherwise, prepend https://
    return `https://${trimmed}`;
  }
}

class ProviderProfileResponseDto {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.bio = data.bio;
    this.major = data.major;
    this.location = data.location;
    this.hourlyRate = data.hourlyRate;
    this.availability = data.availability;
    this.languages = data.languages;
    this.website = data.website;
    this.portfolioLinks = data.portfolioLinks || [];
    this.profileImageUrl = data.profileImageUrl; // 🆕 Profile image
    this.rating = data.rating;
    this.totalReviews = data.totalReviews;
    this.totalProjects = data.totalProjects;
    this.totalEarnings = data.totalEarnings;
    this.viewsCount = data.viewsCount;
    this.successRate = data.successRate;
    this.responseTime = data.responseTime;
    this.isFeatured = data.isFeatured;
    this.isVerified = data.isVerified;
    this.completion = data.completion;
    this.skills = data.skills;
    this.yearsExperience = data.yearsExperience;
    this.minimumProjectBudget = data.minimumProjectBudget;
    this.maximumProjectBudget = data.maximumProjectBudget;
    this.preferredProjectDuration = data.preferredProjectDuration;
    this.workPreference = data.workPreference;
    this.teamSize = data.teamSize;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.user = data.user;
    this.certifications = data.certifications;
    this.portfolios = data.portfolios;
    this.performance = data.performance;
  }

  toResponse() {
    return {
      id: this.id,
      userId: this.userId,
      bio: this.bio,
      major: this.major,
      location: this.location,
      hourlyRate: this.hourlyRate,
      availability: this.availability,
      languages: this.languages,
      website: this.website,
      portfolioLinks: this.portfolioLinks,
      profileImageUrl: this.profileImageUrl, // 🆕 Profile image
      rating: this.rating,
      totalReviews: this.totalReviews,
      totalProjects: this.totalProjects,
      totalEarnings: this.totalEarnings,
      viewsCount: this.viewsCount,
      successRate: this.successRate,
      responseTime: this.responseTime,
      isFeatured: this.isFeatured,
      isVerified: this.isVerified,
      completion: this.completion,
      skills: this.skills,
      yearsExperience: this.yearsExperience,
      minimumProjectBudget: this.minimumProjectBudget,
      maximumProjectBudget: this.maximumProjectBudget,
      preferredProjectDuration: this.preferredProjectDuration,
      workPreference: this.workPreference,
      teamSize: this.teamSize,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      user: this.user,
      certifications: this.certifications,
      portfolios: this.portfolios,
      performance: this.performance,
    };
  }
}

export { ProviderProfileDto, ProviderProfileResponseDto };
