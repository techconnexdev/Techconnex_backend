import express from "express";
import auth from "../modules/auth/index.js";
import companyAuthRoutes from "../modules/auth/company/index.js";
import providerAuthRoutes from "../modules/auth/provider/index.js";
import companyProfileRouter from "../modules/company/profile/index.js";
import findProvidersRouter from "../modules/company/find-providers/index.js";
import findCompaniesRouter from "../modules/provider/find-companies/index.js";
import companyProjectsRouter from "../modules/company/projects/index.js";
import companyProjectRequestsRouter from "../modules/company/project-requests/index.js";
import companyMilestonesRouter from "../modules/company/milestones/index.js";
import companyBillingRouter from "../modules/company/billing/index.js";
import providerSendProposalRouter from "../modules/provider/send-proposal/index.js";
import providerOpportunitiesRouter from "../modules/provider/opportunities/index.js";
import providerMilestonesRouter from "../modules/provider/milestones/index.js";
import providerProjectsRouter from "../modules/provider/projects/index.js";
import resumeRouter from "../modules/resume/index.js";
import certificationsRouter from "../modules/certifications/index.js";
import companyReviewsRouter from "../modules/company/reviews/index.js";
import providerReviewsRouter from "../modules/provider/reviews/index.js";
import klcRoutes from "../modules/auth/KYC/index.js";
import providerProfileRouter from "../modules/provider/profile/index.js";
import providerEarningsRouter from "../modules/provider/billing/index.js";
import messagesRouter from "../modules/messages/index.js";
import settingsRouter from "../modules/settings/index.js";
import adminRouter from "../modules/auth/admin/index.js";
import adminSettingsRouter from "../modules/settings/admin/index.js";
import adminUsersRouter from "../modules/admin/users/index.js";
import adminDisputesRouter from "../modules/admin/disputes/index.js";
import adminProjectsRouter from "../modules/admin/projects/index.js";
import adminReportsRouter from "../modules/admin/reports/index.js";
import adminDashboardRouter from "../modules/admin/dashboard/index.js";
import adminPaymentsRouter from "../modules/admin/payment/index.js";
import disputesRouter from "../modules/disputes/index.js";
import paymentRouter from "../modules/payment/index.js";
import KycRouter from "../modules/kyc/index.js";
import notificationsRoutes from "../modules/notifications/index.js";
import uploadsRouter from "../modules/uploads/index.js";
// import providerCertificateRouter from "../modules/certifications/index.js";

const router = express.Router();

// Mount them
router.use("/auth", auth);
router.use("/kyc", klcRoutes);
router.use("/auth/company", companyAuthRoutes);
router.use("/auth/provider", providerAuthRoutes);
router.use("/company/profile", companyProfileRouter);
router.use("/providers", findProvidersRouter);
router.use("/companies", findCompaniesRouter);
router.use("/company/projects", companyProjectsRouter);
router.use("/company/project-requests", companyProjectRequestsRouter);
router.use("/company/milestones", companyMilestonesRouter);
router.use("/company/billing", companyBillingRouter);
router.use("/company/reviews", companyReviewsRouter);

router.use("/provider/proposals", providerSendProposalRouter);
router.use("/provider/opportunities", providerOpportunitiesRouter);
router.use("/provider/milestones", providerMilestonesRouter);
router.use("/provider/projects", providerProjectsRouter);
router.use("/provider/earnings", providerEarningsRouter);
router.use("/provider/reviews", providerReviewsRouter);
// router.use("/provider/certificate", providerCertificateRouter);
router.use("/resume", resumeRouter);
router.use("/certifications", certificationsRouter);
router.use("/provider/profile", providerProfileRouter);
router.use("/provider/reviews", providerReviewsRouter);

router.use("/messages", messagesRouter);
// Serve static files from uploads directory with proper headers
router.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res, path) => {
      // Set CORS headers for image files
      if (
        path.endsWith(".jpg") ||
        path.endsWith(".jpeg") ||
        path.endsWith(".png") ||
        path.endsWith(".gif") ||
        path.endsWith(".webp")
      ) {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    },
  })
);
router.use("/settings", settingsRouter);
router.use("/admin", adminRouter);
router.use("/admin/settings", adminSettingsRouter);
router.use("/admin/users", adminUsersRouter);
router.use("/admin/disputes", adminDisputesRouter);
router.use("/admin/projects", adminProjectsRouter);
router.use("/admin/reports", adminReportsRouter);
router.use("/admin/dashboard", adminDashboardRouter);
router.use("/admin/payments", adminPaymentsRouter);
router.use("/disputes", disputesRouter);
router.use("/payments", paymentRouter);
router.use("/kyc", KycRouter);
router.use("/notifications", notificationsRoutes);
router.use("/uploads", uploadsRouter);

// Mount check-email under /api so frontend using NEXT_PUBLIC_API_BASE_URL that
// points to http://host:PORT/api will be able to call `${API_BASE}/check-email`
// Simple user endpoint for CustomerLayout
router.get("/users/:id", async (req, res) => {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        customerProfile: true,
        providerProfile: true,
        resume: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Return user data in the format expected by CustomerLayout
    res.json({
      success: true,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      kycStatus: user.kycStatus,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      customerProfile: user.customerProfile,
      providerProfile: user.providerProfile,
      resume: user.resume,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Healthcheck
router.get("/health", (req, res) => res.json({ ok: true }));

export default router;
