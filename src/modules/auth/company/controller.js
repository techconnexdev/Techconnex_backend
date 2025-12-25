// src/modules/company/auth/controller.js
import {
  registerCompany,
  becomeProvider,
  updateCompanyProfile,
  updatePassword,
} from "./service.js";
import { RegisterCompanyDto } from "./dto.js";

async function register(req, res) {
  try {
    // Convert raw body → DTO
    const dto = new RegisterCompanyDto(req.body);

    const user = await registerCompany(dto);
    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
}

async function becomeProviderHandler(req, res) {
  try {
    const userId = req.user.userId;
    const result = await becomeProvider(userId, req.body);

    if (result.alreadyProvider) {
      return res
        .status(200)
        .json({ message: "Already a provider", profile: result.profile });
    }

    res.status(201).json({ success: true, profile: result.profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.userId; // authenticated user
    const updateData = req.body; // any fields to update

    const updatedUser = await updateCompanyProfile(userId, updateData);
    res.status(200).json({ success: true, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updatePasswordHandler(req, res) {
  try {
    const userId = req.user.userId; // from authenticateToken
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Both old and new passwords are required",
        });
    }

    await updatePassword(userId, oldPassword, newPassword);

    res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export { register, becomeProviderHandler, updateProfile, updatePasswordHandler };
