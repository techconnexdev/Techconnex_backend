class RegisterProviderDto {
  constructor(body) {
    this.email = String(body.email).trim();
    this.password = String(body.password);
    this.name = String(body.name).trim();
    this.phone = body.phone ? String(body.phone) : null;

    // Role is always PROVIDER at registration (avoid client injecting ADMIN!)
    this.role = ["PROVIDER"];

    // Default values
    this.kycStatus = "pending_verification";
    this.isVerified = false;

    // Normalize provider profile
    this.providerProfile = this.mapProviderProfile(body.providerProfile || {});
  }

  mapProviderProfile(profile) {
    return {
      bio: profile.bio || "",
      major: profile.major || null,
      location: profile.location || "",
      hourlyRate: profile.hourlyRate ? this.parseHourlyRate(profile.hourlyRate) : null,
      availability: profile.availability || null,
      languages: Array.isArray(profile.languages) ? profile.languages : [],
      website: profile.website || null,
      
      // Performance metrics (defaults from schema)
      rating: profile.rating || 0.00,
      totalReviews: profile.totalReviews || 0,
      totalProjects: profile.totalProjects || 0,
      totalEarnings: profile.totalEarnings || 0.00,
      viewsCount: profile.viewsCount || 0,
      successRate: profile.successRate || 0.00,
      responseTime: profile.responseTime || 0,
      isFeatured: profile.isFeatured || false,
      completion: profile.completion || null,

      // Skills & work preferences
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      yearsExperience: profile.yearsExperience || null,
      minimumProjectBudget: profile.minimumProjectBudget 
        ? this.parseBudget(profile.minimumProjectBudget) 
        : null,
      maximumProjectBudget: profile.maximumProjectBudget 
        ? this.parseBudget(profile.maximumProjectBudget) 
        : null,
      preferredProjectDuration: profile.preferredProjectDuration || null,
      workPreference: profile.workPreference || "remote",
      teamSize: profile.teamSize || 1,
    };
  }

  // Helper: parse hourlyRate safely
  parseHourlyRate(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.]/g, "");
      return cleaned ? parseFloat(cleaned) : null;
    }
    return null;
  }

  // Helper: parse budget values safely
  parseBudget(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.]/g, "");
      return cleaned ? parseFloat(cleaned) : null;
    }
    return null;
  }
}

class LoginProviderDto {
  constructor(body) {
    this.email = String(body.email).trim();
    this.password = String(body.password);
  }
}

export { RegisterProviderDto, LoginProviderDto };
