/**
 * Public Homepage Controller
 * No authentication; safe for unauthenticated visitors.
 */
import {
  getTopFreelancers,
  getTopCompanies,
  getLatestJobs,
  getPublicJobById,
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

/**
 * GET /public/jobs/:id
 * Public detail for an OPEN service request (homepage / showcase).
 */
export async function getPublicJobByIdController(req, res) {
  try {
    const job = await getPublicJobById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found or no longer open",
      });
    }
    res.json({
      success: true,
      opportunity: job,
    });
  } catch (error) {
    console.error("Error in getPublicJobByIdController:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load job",
    });
  }
}
