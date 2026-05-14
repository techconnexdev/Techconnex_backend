import { adminProjectModel } from "./model.js";

export const adminProjectService = {
  async getAllProjects(filters = {}) {
    try {
      const projects = await adminProjectModel.getAllProjects(filters);
      return projects;
    } catch (error) {
      throw new Error(`Failed to get projects: ${error.message}`);
    }
  },

  async createProject(data) {
    try {
      const project = await adminProjectModel.createProject(data);
      return project;
    } catch (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  },

  async getProjectById(projectId) {
    try {
      const project = await adminProjectModel.getProjectById(projectId);
      if (!project) {
        throw new Error("Project not found");
      }
      return project;
    } catch (error) {
      throw new Error(`Failed to get project: ${error.message}`);
    }
  },

  async updateProject(projectId, updateData) {
    try {
      const project = await adminProjectModel.updateProject(projectId, updateData);
      return project;
    } catch (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
  },

  async getProjectStats() {
    try {
      const stats = await adminProjectModel.getProjectStats();
      return stats;
    } catch (error) {
      throw new Error(`Failed to get project stats: ${error.message}`);
    }
  },
};

