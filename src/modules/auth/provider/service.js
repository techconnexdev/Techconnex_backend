import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  findUserByEmail,
  findUserById,
  createProviderUser,
  findProviderProfile,
  updateUserRole,
} from "./model.js";
import { createProviderAiDraft } from "./provider-ai-draft.js";
import { notifyAdminsOfNewUser } from "../../notifications/service.js";
import { prisma } from "../../../utils/prisma.js";
import { consumePhoneReadyForRegistration } from "../phoneRegistrationVerify.js";

async function registerProvider(dto) {
  const existingUser = await findUserByEmail(dto.email);
  if (existingUser) throw new Error("User already exists");

  const hashedPassword = await bcrypt.hash(dto.password, 10);

  const phoneVerified =
    Boolean(dto.phone && String(dto.phone).trim()) &&
    consumePhoneReadyForRegistration(dto.phone);

  // Pass entire DTO, but overwrite the password
  const user = await createProviderUser({
    ...dto,
    password: hashedPassword,
    phoneVerified,
  });

  // Notify all admins about the new user registration
  try {
    await notifyAdminsOfNewUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (notificationError) {
    // Log error but don't fail registration
    console.error(
      "Failed to notify admins of new user registration:",
      notificationError,
    );
  }

  // Try to generate AI draft for provider profile if profile exists
  try {
    const profile = await findProviderProfile(user.id);
    if (profile && profile.id) {
      // fire-and-forget, but await to ensure saved before returning
      await createProviderAiDraft(profile.id);
    }
  } catch (err) {
    // Log and continue — registration should not fail because of AI draft
    console.error("Failed to create provider AI draft:", err);
  }

  // Generate token for auto-login (same as auth login)
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  // Return user without password
  const { password: _p, ...safeUser } = user;
  return { token, user: safeUser };
}

async function becomeCustomer(userId, { description = "", industry = "" }) {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  // Check if customer profile exists
  const existing = await prisma.customerProfile.findUnique({
    where: { userId },
  });
  if (existing) return { alreadyCustomer: true, profile: existing };

  // Create customer profile
  const profile = await prisma.customerProfile.create({
    data: {
      userId,
      description,
      industry,
    },
  });

  // Update roles → ensure it's an array
  let roles = user.role;
  if (!Array.isArray(roles)) roles = [roles];
  if (!roles.includes("CUSTOMER")) {
    roles.push("CUSTOMER");
    await updateUserRole(userId, roles);
  }

  return { alreadyCustomer: false, profile };
}
async function updatePassword(userId, oldPassword, newPassword) {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  // Verify old password
  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) throw new Error("Old password is incorrect");

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  const updatedUser = await updateCompanyUser(userId, {
    password: hashedPassword,
  });
  return updatedUser;
}

export { registerProvider, becomeCustomer, updatePassword };
