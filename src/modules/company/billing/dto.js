class CompanyProfileDto {
  constructor(data) {
    this.description = data.description;
    this.industry = data.industry;
    this.location = data.location;
    this.website = data.website;
    this.profileImageUrl = data.profileImageUrl;
    this.socialLinks = data.socialLinks;
    this.languages = data.languages || [];
    this.companySize = data.companySize;
    this.employeeCount = data.employeeCount;
    this.establishedYear = data.establishedYear;
    this.annualRevenue = data.annualRevenue;
    this.fundingStage = data.fundingStage;
    this.preferredContractTypes = data.preferredContractTypes || [];
    this.averageBudgetRange = data.averageBudgetRange;
    this.remotePolicy = data.remotePolicy;
    this.hiringFrequency = data.hiringFrequency;
    this.categoriesHiringFor = data.categoriesHiringFor || [];
    this.mission = data.mission;
    this.values = data.values || [];
    this.benefits = data.benefits;
    this.mediaGallery = data.mediaGallery || [];
  }

  validate() {
    const errors = [];

    // Required fields validation
    if (!this.description || this.description.trim().length < 10) {
      errors.push("Description must be at least 10 characters long");
    }

    if (!this.industry) {
      errors.push("Industry is required");
    }

    if (!this.location) {
      errors.push("Location is required");
    }

    // Optional field validations
    if (this.website && !this.isValidUrl(this.website)) {
      errors.push("Website must be a valid URL");
    }

    if (this.profileImageUrl && !this.isValidUrl(this.profileImageUrl)) {
      errors.push("Logo URL must be a valid URL");
    }

    if (this.employeeCount && (this.employeeCount < 1 || this.employeeCount > 1000000)) {
      errors.push("Employee count must be between 1 and 1,000,000");
    }

    if (this.establishedYear && (this.establishedYear < 1800 || this.establishedYear > new Date().getFullYear())) {
      errors.push("Established year must be between 1800 and current year");
    }

    if (this.annualRevenue && this.annualRevenue < 0) {
      errors.push("Annual revenue cannot be negative");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }

    return true;
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  toUpdateData() {
    return {
      description: this.description,
      industry: this.industry,
      location: this.location,
      website: this.website,
      profileImageUrl: this.profileImageUrl,
      socialLinks: this.socialLinks,
      languages: this.languages,
      companySize: this.companySize,
      employeeCount: this.employeeCount,
      establishedYear: this.establishedYear,
      annualRevenue: this.annualRevenue,
      fundingStage: this.fundingStage,
      preferredContractTypes: this.preferredContractTypes,
      averageBudgetRange: this.averageBudgetRange,
      remotePolicy: this.remotePolicy,
      hiringFrequency: this.hiringFrequency,
      categoriesHiringFor: this.categoriesHiringFor,
      mission: this.mission,
      values: this.values,
      benefits: this.benefits,
      mediaGallery: this.mediaGallery,
    };
  }
}

class CompanyProfileUpdateDto {
  constructor(data) {
    // Allow partial updates - only include fields that are provided
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        this[key] = data[key];
      }
    });
  }

  validate() {
    const errors = [];

    // Validate only provided fields
    if (this.description !== undefined && (!this.description || this.description.trim().length < 10)) {
      errors.push("Description must be at least 10 characters long");
    }

    if (this.website && !this.isValidUrl(this.website)) {
      errors.push("Website must be a valid URL");
    }

    if (this.profileImageUrl && !this.isValidUrl(this.profileImageUrl)) {
      errors.push("Logo URL must be a valid URL");
    }

    if (this.employeeCount !== undefined && (this.employeeCount < 1 || this.employeeCount > 1000000)) {
      errors.push("Employee count must be between 1 and 1,000,000");
    }

    if (this.establishedYear !== undefined && (this.establishedYear < 1800 || this.establishedYear > new Date().getFullYear())) {
      errors.push("Established year must be between 1800 and current year");
    }

    if (this.annualRevenue !== undefined && this.annualRevenue < 0) {
      errors.push("Annual revenue cannot be negative");
    }

    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }

    return true;
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  toUpdateData() {
    const updateData = {};
    Object.keys(this).forEach(key => {
      if (this[key] !== undefined && this[key] !== null) {
        updateData[key] = this[key];
      }
    });
    return updateData;
  }
}

class CompanyProfileResponseDto {
  constructor(profileData) {
    this.profileData = profileData;
  }

  toResponse() {
    const user = this.profileData.user;
    const stats = this.profileData.stats;
    
    return {
      // User-level data (flattened)
      email: user?.email || null,
      name: user?.name || null,
      phone: user?.phone || null,
      isVerified: user?.isVerified || false,
      kycStatus: user?.kycStatus || null,
      createdAt: user?.createdAt || null,
      
      // Customer profile data (nested object)
      customerProfile: {
        description: this.profileData.description,
        industry: this.profileData.industry,
        location: this.profileData.location,
        website: this.profileData.website,
        profileImageUrl: this.profileData.profileImageUrl,
        socialLinks: this.profileData.socialLinks || [],
        languages: this.profileData.languages || [],
        companySize: this.profileData.companySize,
        employeeCount: this.profileData.employeeCount,
        establishedYear: this.profileData.establishedYear,
        annualRevenue: this.profileData.annualRevenue,
        fundingStage: this.profileData.fundingStage,
        preferredContractTypes: this.profileData.preferredContractTypes || [],
        averageBudgetRange: this.profileData.averageBudgetRange,
        remotePolicy: this.profileData.remotePolicy,
        hiringFrequency: this.profileData.hiringFrequency,
        categoriesHiringFor: this.profileData.categoriesHiringFor || [],
        completion: this.profileData.completion || 0,
        rating: this.profileData.rating || 0,
        reviewCount: this.profileData.reviewCount || 0,
        totalSpend: stats?.totalSpend || this.profileData.totalSpend || 0,
        projectsPosted: stats?.projectsPosted || this.profileData.projectsPosted || 0,
        lastActiveAt: this.profileData.lastActiveAt,
        mission: this.profileData.mission,
        values: this.profileData.values || [],
        benefits: this.profileData.benefits,
        mediaGallery: this.profileData.mediaGallery || [],
      },
      
      // KYC documents (if available)
      kycDocuments: user?.KycDocument || [],
    };
  }
}

class KycDocumentResponseDto {
  constructor(documentData) {
    this.id = documentData.id;
    this.type = documentData.type;
    this.fileUrl = documentData.fileUrl;
    this.filename = documentData.filename;
    this.mimeType = documentData.mimeType;
    this.status = documentData.status;
    this.reviewNotes = documentData.reviewNotes;
    this.reviewedBy = documentData.reviewedBy;
    this.uploadedAt = documentData.uploadedAt;
    this.reviewedAt = documentData.reviewedAt;
  }

  toResponse() {
    return {
      id: this.id,
      type: this.type,
      fileUrl: this.fileUrl,
      filename: this.filename,
      mimeType: this.mimeType,
      status: this.status,
      reviewNotes: this.reviewNotes,
      reviewedBy: this.reviewedBy,
      uploadedAt: this.uploadedAt,
      reviewedAt: this.reviewedAt,
    };
  }
}

export {
  CompanyProfileDto,
  CompanyProfileUpdateDto,
  CompanyProfileResponseDto,
  KycDocumentResponseDto,
};
