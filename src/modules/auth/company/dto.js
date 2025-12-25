class RegisterCompanyDto {
  constructor(body) {
    this.email = String(body.email).trim();
    this.password = String(body.password);
    this.name = String(body.name).trim();
    this.phone = body.phone ? String(body.phone) : null;

    // Role is always CUSTOMER at registration (avoid client injecting ADMIN!)
    this.role = ["CUSTOMER"];

    // Default values
    this.kycStatus = "pending_verification";
    this.isVerified = false;

    // Normalize customer profile
    this.customerProfile = this.mapCustomerProfile(body.customerProfile || {});

    // ✅ Optional KYC documents
    this.kycDocuments = Array.isArray(body.kycDocuments)
      ? body.kycDocuments.map(this.mapKycDocument)
      : [];
  }

  mapCustomerProfile(profile) {
    return {
      description: profile.description || "",
      industry: profile.industry || "",
      location: profile.location || "",
      website: profile.website || null,
      profileImageUrl: profile.profileImageUrl || null,
      socialLinks: Array.isArray(profile.socialLinks)
        ? profile.socialLinks
        : null,
      languages: Array.isArray(profile.languages) ? profile.languages : [],
      companySize: profile.companySize || null,
      employeeCount: profile.employeeCount || null,
      establishedYear: profile.establishedYear || null,

      // Ensure annualRevenue is numeric (convert string → number)
      annualRevenue: profile.annualRevenue
        ? this.parseAnnualRevenue(profile.annualRevenue)
        : null,

      fundingStage: profile.fundingStage || null,
      preferredContractTypes: Array.isArray(profile.preferredContractTypes)
        ? profile.preferredContractTypes
        : [],
      averageBudgetRange: profile.averageBudgetRange || null,
      remotePolicy: profile.remotePolicy || null,
      hiringFrequency: profile.hiringFrequency || null,
      categoriesHiringFor: Array.isArray(profile.categoriesHiringFor)
        ? profile.categoriesHiringFor
        : [],
      completion: profile.completion || null,
      rating: profile.rating || 0,
      reviewCount: profile.reviewCount || 0,
      totalSpend: profile.totalSpend || null,
      projectsPosted: profile.projectsPosted || 0,
      lastActiveAt: profile.lastActiveAt
        ? new Date(profile.lastActiveAt)
        : null,
      mission: profile.mission || null,
      values: Array.isArray(profile.values) ? profile.values : [],
      benefits: profile.benefits || null,
      mediaGallery: Array.isArray(profile.mediaGallery)
        ? profile.mediaGallery
        : [],
    };
  }
    mapKycDocument(doc) {
    return {
      type: doc.type, // e.g. "COMPANY_REG", "PROVIDER_ID", etc.
      fileUrl: doc.fileUrl,
      filename: doc.filename,
      mimeType: doc.mimeType || null,
      status: "uploaded",
    };
  }

  // Helper: parse annualRevenue safely
  parseAnnualRevenue(value) {
    if (typeof value === "number") return value;

    if (typeof value === "string") {
      // Try to extract numbers
      const cleaned = value.replace(/[^\d.]/g, ""); // remove non-numeric
      return cleaned ? parseFloat(cleaned) : null;
    }
    return null;
  }
}

class LoginCompanyDto {
  constructor(body) {
    this.email = String(body.email).trim();
    this.password = String(body.password);
  }
}

export { RegisterCompanyDto, LoginCompanyDto };
