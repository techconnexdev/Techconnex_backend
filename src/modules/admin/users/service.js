import bcrypt from "bcryptjs";
import { userModel } from "./model.js";

export const userService = {
  async getAllUsers(filters = {}) {
    try {
      const users = await userModel.getAllUsers(filters);
      return users;
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  },

  async getUserById(userId) {
    try {
      const user = await userModel.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    } catch (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
  },

  async suspendUser(userId) {
    try {
      const user = await userModel.updateUserStatus(userId, "SUSPENDED");
      return user;
    } catch (error) {
      throw new Error(`Failed to suspend user: ${error.message}`);
    }
  },

  async activateUser(userId) {
    try {
      const user = await userModel.updateUserStatus(userId, "ACTIVE");
      return user;
    } catch (error) {
      throw new Error(`Failed to activate user: ${error.message}`);
    }
  },

  async updateUser(userId, updateData) {
    try {
      const user = await userModel.updateUser(userId, updateData);
      return user;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  },

  async getUserStats() {
    try {
      const stats = await userModel.getUserStats();
      return stats;
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  },

  async createUser(userData) {
    try {
      // Check if user with email already exists
      const existingUser = await userModel.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error("User with this email already exists");
      }

      // Hash the password before creating user
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await userModel.createUser({
        ...userData,
        password: hashedPassword,
      });
      return user;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  },
};

