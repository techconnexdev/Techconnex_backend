import KycModel from "./model.js";

class KycService {
  
  // Get KYC documents for a user
  static async getKycDocuments(userId) {
    try {
      const documents = await KycModel.getKycDocuments(userId);
      return { documents };
    } catch (error) {
      throw new Error(`Failed to get KYC documents: ${error.message}`);
    }
  }

  // Get KYC document by ID
  static async getKycDocumentById(documentId) {
    try {
      const document = await KycModel.getKycDocumentById(documentId);
      
      if (!document) {
        throw new Error("KYC document not found");
      }

      return { document };
    } catch (error) {
      throw new Error(`Failed to get KYC document: ${error.message}`);
    }
  }

  // Get user with enhanced KYC data
  static async getUserWithKycData(userId) {
    try {
      const user = await KycModel.getUserWithKycData(userId);
      
      if (!user) {
        throw new Error("User not found");
      }

      return { user };
    } catch (error) {
      throw new Error(`Failed to get user with KYC data: ${error.message}`);
    }
  }

}


export default KycService;