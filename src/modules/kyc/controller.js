import kycService from "./service.js";
// Get KYC documents for the authenticated user
export async function getKycDocuments(req, res) {
  try {
    const userId = req.user.userId;
    const result = await kycService.getKycDocuments(userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get KYC documents error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// Get KYC document by ID
export async function getKycDocumentById(req, res) {
  try {
    const { documentId } = req.params;
    const result = await kycService.getKycDocumentById(documentId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get KYC document by ID error:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// Get user with enhanced KYC data
export async function getUserWithKycData(req, res) {
  try {
    const userId = req.user.userId;
    const result = await kycService.getUserWithKycData(userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get user with KYC data error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
