import * as service from "./service.js";
import { createNotification } from "../../notifications/service.js";

export async function getAllReports(req, res) {
  try {
    const { status, search } = req.query;
    const reports = await service.getAllConversationReports({
      status,
      search,
    });
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error("Get conversation reports error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reports",
    });
  }
}

export async function getReportById(req, res) {
  try {
    const { id } = req.params;
    const report = await service.getConversationReportById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }
    res.json({ success: true, data: report });
  } catch (error) {
    console.error("Get report by id error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch report",
    });
  }
}

export async function getReportMessages(req, res) {
  try {
    const { id } = req.params;
    const messages = await service.getMessagesBetweenReportUsers(id);
    if (messages === null) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error("Get report messages error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch messages",
    });
  }
}

export async function patchStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || typeof status !== "string") {
      return res.status(400).json({ message: "status is required" });
    }
    const report = await service.updateReportStatus(id, status.toUpperCase());
    return res.json(report);
  } catch (e) {
    if (e.message === "Invalid status") {
      return res.status(400).json({ message: e.message });
    }
    if (e.code === "P2025") {
      return res.status(404).json({ message: "Report not found" });
    }
    return res.status(500).json({ message: "Failed to update report status" });
  }
}

export async function postSendNotification(req, res) {
  try {
    const { userId, title, content } = req.body;
    if (!userId || !title || !content) {
      return res
        .status(400)
        .json({ message: "userId, title, and content are required" });
    }
    const notification = await createNotification({
      userId,
      title,
      content,
      type: "system",
    });
    return res.json(notification);
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(500).json({ message: "Failed to send notification" });
  }
}

export async function getStats(req, res) {
  try {
    const stats = await service.getConversationReportStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Get conversation report stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch stats",
    });
  }
}
