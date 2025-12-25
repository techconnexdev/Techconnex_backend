// server.js
import "dotenv/config.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";

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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "API is healthy" });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("💥 Global error:", err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;