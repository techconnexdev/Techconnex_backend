// server.js
import "dotenv/config.js";
import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import { FRIENDLY_500_MESSAGE } from "./utils/errors.js";

const app = express();

// Security middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// Enable CORS for all routes
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// Log HTTP requests in development
app.use(morgan("dev"));

// ⚠️ CRITICAL: Webhook route MUST come BEFORE express.json()
// This ensures the webhook receives raw body for signature verification
app.use(
  "/payments/webhooks/stripe",
  express.raw({ type: "application/json" })
);

// Parse incoming JSON for all OTHER routes
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Register routes
app.use("", routes);

// TEMPORARY: Sentry test route — remove before production
app.get("/debug-sentry", (req, res) => {
  Sentry.captureMessage("Sentry warning test from /debug-sentry", "warning");
  if (req.query.error === "1") {
    throw new Error("Sentry error test from /debug-sentry");
  }
  res.json({ ok: true, message: "Sentry warning sent. Add ?error=1 to trigger an error." });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "API is healthy" });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Sentry: error handler (after all routes, before other error middlewares)
Sentry.setupExpressErrorHandler(app);

// Global error handler
app.use((err, req, res, next) => {
  console.error("💥 Global error:", err);
  Sentry.captureException(err);
  const status = err.status || 500;
  const message = status >= 500 ? FRIENDLY_500_MESSAGE : (err.message || "Something went wrong");
  res.status(status).json({
    success: false,
    message,
  });
});

export default app;