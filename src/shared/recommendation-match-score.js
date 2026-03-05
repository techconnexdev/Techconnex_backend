/**
 * Shared matching algorithm for provider ↔ service request recommendations.
 * Used by both company (find-providers) and provider (opportunities) so that
 * the same opportunity ⇒ same recommended providers / same scores everywhere.
 *
 * Weights: skills 40%, category 20%, budget 20%, timeline/availability 20%.
 */

/**
 * Calculate match score between provider profile and service request.
 * @param {object} providerProfile - Provider profile (skills, major, hourlyRate, availability, etc.)
 * @param {object} serviceRequest - Service request (skills, category, budgetMin, budgetMax, timeline)
 * @returns {number} Score 0-100
 */
export function calculateMatchScore(providerProfile, serviceRequest) {
  // No meaningful match without provider skills — do not show score or use for ranking
  const providerSkills = (providerProfile.skills || []).map((s) =>
    String(s).toLowerCase().trim(),
  ).filter(Boolean);
  if (providerSkills.length === 0) {
    return null;
  }

  let score = 0;
  const maxScore = 100;

  const requestSkills = (serviceRequest.skills || []).map((s) =>
    String(s).toLowerCase(),
  );

  // Skills overlap (40% weight)
  if (requestSkills.length > 0) {
    const matchingSkills = requestSkills.filter((skill) =>
      providerSkills.some((ps) => ps.includes(skill) || skill.includes(ps)),
    );
    const skillsScore = (matchingSkills.length / requestSkills.length) * 40;
    score += skillsScore;
  } else {
    score += 20; // Neutral score if no skills specified
  }

  // Category match (20% weight)
  if (providerProfile.major && serviceRequest.category) {
    const providerMajor = String(providerProfile.major).toLowerCase();
    const requestCategory = String(serviceRequest.category).toLowerCase();

    if (
      providerMajor === requestCategory ||
      providerMajor.includes(requestCategory) ||
      requestCategory.includes(providerMajor)
    ) {
      score += 20;
    } else {
      const categoryKeywords = {
        web: ["web", "frontend", "backend", "fullstack"],
        mobile: ["mobile", "app", "ios", "android"],
        cloud: ["cloud", "aws", "azure", "devops"],
        ai: ["ai", "ml", "machine learning", "artificial intelligence"],
        data: ["data", "analytics", "database"],
        design: ["design", "ui", "ux"],
      };

      let foundMatch = false;
      for (const [, keywords] of Object.entries(categoryKeywords)) {
        if (
          keywords.some(
            (k) => providerMajor.includes(k) || requestCategory.includes(k),
          )
        ) {
          score += 10; // Partial match
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        score += 3; // Minimal match
      }
    }
  } else {
    score += 10; // Neutral score
  }

  // Budget compatibility (20% weight)
  const requestBudgetMin = Number(serviceRequest.budgetMin) || 0;
  const requestBudgetMax = Number(serviceRequest.budgetMax) || Infinity;
  const providerMinBudget = Number(providerProfile.minimumProjectBudget) || 0;
  const providerMaxBudget =
    Number(providerProfile.maximumProjectBudget) || Infinity;
  const providerHourlyRate = Number(providerProfile.hourlyRate) || 0;

  if (
    providerMinBudget <= requestBudgetMax &&
    providerMaxBudget >= requestBudgetMin
  ) {
    score += 20; // Budgets are compatible
  } else if (providerHourlyRate > 0) {
    const estimatedMin = providerHourlyRate * 40;
    const estimatedMax = providerHourlyRate * 200;
    if (estimatedMin <= requestBudgetMax && estimatedMax >= requestBudgetMin) {
      score += 15; // Estimated budget compatibility
    } else {
      score += 5; // Budget mismatch
    }
  } else {
    score += 10; // No budget info, neutral
  }

  // Timeline & availability fit (20% weight)
  if (serviceRequest.timeline && providerProfile.availability) {
    const timeline = String(serviceRequest.timeline).toLowerCase();
    const availability = String(providerProfile.availability).toLowerCase();
    const urgentKeywords = ["urgent", "asap", "immediate", "quick", "fast"];
    const isUrgent = urgentKeywords.some((keyword) =>
      timeline.includes(keyword),
    );

    if (
      isUrgent &&
      (availability.includes("available") || availability.includes("immediate"))
    ) {
      score += 20;
    } else if (!isUrgent && availability.includes("available")) {
      score += 15;
    } else {
      score += 8;
    }
  } else {
    score += 10; // Neutral score
  }

  return Math.min(Math.round(score), maxScore);
}
