import { adminProjectService } from "./service.js";

export const adminProjectController = {
  async getAllProjects(req, res) {
    try {
      const { status, search } = req.query;
      const filters = { status, search };
      
      const projects = await adminProjectService.getAllProjects(filters);
      
      res.json({
        success: true,
        data: projects,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getProjectById(req, res) {
    try {
      const { id } = req.params;
      const project = await adminProjectService.getProjectById(id);
      
      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  },

  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const project = await adminProjectService.updateProject(id, updateData);
      
      res.json({
        success: true,
        message: "Project updated successfully",
        data: project,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getProjectStats(req, res) {
    try {
      const stats = await adminProjectService.getProjectStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

