// src/modules/certifications/certification.controller.js
import {
  uploadCertifications,
  getCertificationsByUser,
  deleteCertification,
} from "./service.js";

export const uploadCertificationsController = async (req, res, next) => {
  try {
    const { userId, certifications } = req.body;

    if (!userId || !Array.isArray(certifications)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload: userId and certifications are required.",
      });
    }

    const result = await uploadCertifications(userId, certifications);
    res.json({
      success: true,
      message: `${certifications.length} certifications uploaded successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCertificationsController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const data = await getCertificationsByUser(userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteCertificationController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // from authenticateToken middleware

    const result = await deleteCertification(id, userId);
    res.json({ success: true, message: "Certification deleted.", data: result });
  } catch (error) {
    next(error);
  }
};
