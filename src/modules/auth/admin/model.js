import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const userModel = {
  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  async createAdmin({ email, password, name }) {
    return prisma.user.create({
      data: {
        email,
        password,
        name,
        role: ["ADMIN"],
        isVerified: true,
      },
    });
  },

  async findAllAdmins() {
    return prisma.user.findMany({
      where: { role: { has: "ADMIN" } },
    });
  },

  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },
};

export default prisma;
