// Must load before any other imports (see index.js)
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://fa853218a232ca98371af05e687be47d@o4510990701297664.ingest.de.sentry.io/4510990708965456",
  environment: process.env.NODE_ENV || "development",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});
