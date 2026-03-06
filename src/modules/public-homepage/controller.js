/**
 * Public Homepage Controller
 * No authentication; safe for unauthenticated visitors.
 */
import {
  getTopFreelancers,
  getTopCompanies,
  getLatestJobs,
} from "./service.js";

/**
 * GET /public/homepage
 * Returns top freelancers, top companies, and latest jobs in one response.
 */
export async function getHomepageData(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 6, 12);
    const [topFreelancers, topCompanies, latestJobs] = await Promise.all([
      getTopFreelancers(limit),
      getTopCompanies(limit),
      getLatestJobs(limit),
    ]);
    res.json({
      success: true,
      data: {
        topFreelancers,
        topCompanies,
        latestJobs,
      },
    });
  } catch (error) {
    console.error("Error in getHomepageData:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load homepage data",
    });
  }
}
