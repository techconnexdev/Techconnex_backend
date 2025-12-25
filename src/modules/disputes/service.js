import { disputeModel } from "./model.js";

export const disputeService = {
  async createDispute(data) {
    try {
      const dispute = await disputeModel.createDispute(data);
      return dispute;
    } catch (error) {
      throw new Error(`Failed to create dispute: ${error.message}`);
    }
  },

  async getDisputeById(disputeId) {
    try {
      const dispute = await disputeModel.getDisputeById(disputeId);
      if (!dispute) {
        throw new Error("Dispute not found");
      }
      return dispute;
    } catch (error) {
      throw new Error(`Failed to get dispute: ${error.message}`);
    }
  },

  async getDisputeByProject(projectId) {
    try {
      const dispute = await disputeModel.getDisputeByProject(projectId);
      return dispute;
    } catch (error) {
      throw new Error(`Failed to get dispute: ${error.message}`);
    }
  },

  async updateDispute(disputeId, data) {
    try {
      const dispute = await disputeModel.updateDispute(disputeId, data);
      return dispute;
    } catch (error) {
      throw new Error(`Failed to update dispute: ${error.message}`);
    }
  },

  async autoResolveDisputeOnProjectCompletion(projectId) {
    try {
      // Find any UNDER_REVIEW dispute for this project
      const dispute = await disputeModel.getDisputeByProject(projectId);
      
      if (dispute && dispute.status === "UNDER_REVIEW") {
        // Auto-resolve the dispute
        await disputeModel.updateDisputeStatus(
          dispute.id,
          "RESOLVED",
          "Project completed peacefully. Dispute automatically resolved."
        );
        
        return dispute;
      }
      
      return null;
    } catch (error) {
      console.error("Error auto-resolving dispute:", error);
      // Don't throw - this is a background operation
      return null;
    }
  },

  async getDisputesByProject(projectId) {
    try {
      const disputes = await disputeModel.getDisputesByProject(projectId);
      return disputes;
    } catch (error) {
      throw new Error(`Failed to get disputes: ${error.message}`);
    }
  },
};

