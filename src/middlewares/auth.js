import jwt from "jsonwebtoken";
import { findUserById } from "../modules/auth/model.js";

async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Normalize both possible token formats
    if (payload.userId && !payload.id) {
      payload.id = payload.userId;
    }

    // ✅ Ensure roles array
    if (Array.isArray(payload.role)) {
      payload.roles = payload.role;
    } else if (payload.role) {
      payload.roles = [payload.role];
    } else {
      payload.roles = [];
    }

    // ✅ Re-check user status on every authenticated request
    const userId = payload.id || payload.userId;
    if (userId) {
      const user = await findUserById(userId);
      if (!user) {
        return res.status(401).json({ message: "Account not found. Please contact support.", code: "ACCOUNT_NOT_FOUND" });
      }

      if (user.status === "SUSPENDED") {
        return res.status(403).json({
          message:
            "Your account has been suspended. Please contact TechConnect support at support@techconnect.my or +60312345678.",
          code: "ACCOUNT_SUSPENDED",
        });
      }
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
}

/**
 * Optional auth: if a valid token is present, set req.user; otherwise continue without 401.
 * Use for routes that work for both guests and logged-in users (e.g. public provider profile).
 */
function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return next();

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return next();

    if (payload.userId && !payload.id) payload.id = payload.userId;
    if (Array.isArray(payload.role)) payload.roles = payload.role;
    else if (payload.role) payload.roles = [payload.role];
    else payload.roles = [];

    req.user = payload;
    next();
  });
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const ok = allowedRoles.some(r => roles.includes(r));
    if (!ok) return res.status(403).json({ message: "Access denied" });
    next();
  };
}

// Socket.IO authentication middleware (updated)
export const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    console.log("❌ No token provided in socket handshake");
    return next(new Error("No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Normalize id like HTTP middleware
    if (decoded.userId && !decoded.id) {
      decoded.id = decoded.userId;
    }

    const userId = decoded.id || decoded.userId;
    if (userId) {
      const user = await findUserById(userId);
      if (!user) {
        console.log("❌ Socket auth: account not found");
        return next(new Error("Account not found"));
      }
      if (user.status === "SUSPENDED") {
        console.log("❌ Socket auth: account suspended", userId);
        return next(new Error("ACCOUNT_SUSPENDED"));
      }
    }

    socket.user = decoded;
    next();
  } catch (err) {
    console.log("❌ Invalid token");
    return next(new Error("Invalid token"));
  }
}

export const requireAdmin = (req, res, next) => {
  const roles = req.user?.roles || [];
  if (!roles.includes("ADMIN")) {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
};

export { authenticateToken, optionalAuthenticateToken, authorizeRoles };
