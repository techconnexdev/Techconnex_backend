import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userModel } from "./model.js";
import { notifyAdminsOfNewUser } from "../../notifications/service.js";


const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export const authService = {
  async register({ name, email, password }) {
    const existing = await userModel.findByEmail(email);
    if (existing) throw new Error("Email already registered");

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await userModel.createAdmin({
      email,
      password: hashedPassword,
      name,
    });

    // Notify other admins about the new admin registration
    try {
      await notifyAdminsOfNewUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch (notificationError) {
      // Log error but don't fail registration
      console.error("Failed to notify admins of new admin registration:", notificationError);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return { token, user };
  },

  async login(email, password) {
    const user = await userModel.findByEmail(email);
    if (!user) throw new Error("Invalid email or password");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Invalid email or password");

    if (!user.role.includes("ADMIN")) throw new Error("Access denied: not an admin");

    // Check if account is suspended
    if (user.status === "SUSPENDED") {
      throw new Error("Your account has been suspended. Please contact support.");
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return { token, user };
  },
};
