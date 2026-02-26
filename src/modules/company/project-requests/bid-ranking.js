// src/modules/company/project-requests/bid-ranking.js
/**
 * Score a proposal against its service request (project) to rank "best fit" bids.
 * Returns a number 0–100. Used to show top 5 proposals and AI explanation.
 */
export function calculateProposalScore(proposal, serviceRequest) {
  if (!serviceRequest) return 0;
  let score = 0;
  const maxScore = 100;

  const provider = proposal.provider || {};
  const profile = provider.providerProfile || {};
  const bidAmount = Number(proposal.bidAmount) || 0;
  const budgetMin = Number(serviceRequest.budgetMin) || 0;
  const budgetMax = Number(serviceRequest.budgetMax) || Infinity;
  const requestSkills = Array.isArray(serviceRequest.skills) ? serviceRequest.skills : [];
  const providerSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const rating = Number(profile.rating) || 0;
  const yearsExperience = Number(profile.yearsExperience) || 0;
  const totalProjects = Number(profile.totalProjects) || 0;
  const successRate = Number(profile.successRate) || 0;
  const coverLetter = (proposal.coverLetter || "").trim();
  const milestones = Array.isArray(proposal.milestones) ? proposal.milestones : [];

  // Budget fit (25%): bid within range is best
  if (budgetMax > budgetMin) {
    if (bidAmount >= budgetMin && bidAmount <= budgetMax) {
      score += 25;
    } else if (bidAmount > 0 && bidAmount <= budgetMax * 1.15) {
      score += 15; // Slightly over budget
    } else if (bidAmount >= budgetMin * 0.85) {
      score += 10; // Slightly under
    } else {
      score += 5;
    }
  } else {
    score += 12;
  }

  // Skills overlap (25%)
  if (requestSkills.length > 0) {
    const req = requestSkills.map((s) => String(s).toLowerCase());
    const prov = providerSkills.map((s) => String(s).toLowerCase());
    const matchCount = req.filter((r) =>
      prov.some((p) => p.includes(r) || r.includes(p))
    ).length;
    score += (matchCount / requestSkills.length) * 25;
  } else {
    score += 12;
  }

  // Provider quality (20%): rating, experience, success rate
  score += Math.min(20, (rating / 5) * 8);
  if (yearsExperience >= 5) score += 4;
  else if (yearsExperience >= 2) score += 2;
  if (totalProjects >= 10) score += 4;
  else if (totalProjects >= 1) score += 2;
  if (successRate >= 90) score += 4;
  else if (successRate >= 70) score += 2;

  // Proposal completeness (15%): cover letter + milestones
  if (coverLetter.length >= 100) score += 8;
  else if (coverLetter.length >= 30) score += 4;
  if (milestones.length > 0) {
    const sum = milestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    if (Math.abs(sum - bidAmount) < 1) score += 7; // Milestones sum to bid
    else score += 3;
  }

  // Timeline (15%): has proposed timeline
  const deliveryTime = proposal.deliveryTime || proposal.timeline || "";
  if (deliveryTime && (String(deliveryTime).match(/\d+/) || deliveryTime.length > 2)) {
    score += 15;
  } else {
    score += 5;
  }

  return Math.min(Math.round(score), maxScore);
}

/**
 * Rank proposals by score and attach matchScore, rank (1-based), and isTopFive.
 * Modifies each proposal with score, rank, isTopFive. Returns sorted array (best first).
 */
export function rankProposals(proposals, serviceRequest) {
  if (!proposals.length) return [];
  const withScores = proposals.map((p) => ({
    proposal: p,
    score: calculateProposalScore(p, serviceRequest),
  }));
  withScores.sort((a, b) => b.score - a.score);
  const ranked = [];
  withScores.forEach(({ proposal, score }, index) => {
    const rank = index + 1;
    ranked.push({
      ...proposal,
      matchScore: score,
      rank,
      isTopFive: rank <= 5,
    });
  });
  return ranked;
}
