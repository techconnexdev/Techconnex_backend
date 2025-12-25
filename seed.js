// seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create a test customer user
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const customerUser = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      password: hashedPassword,
      name: "Test Customer",
      phone: "123456789",
      role: ["CUSTOMER"],
      kycStatus: "active",
      isVerified: true,
    },
  });

  // Create customer profile
  await prisma.customerProfile.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: {
      userId: customerUser.id,
      description: "A test customer company",
      industry: "Technology",
      location: "Kuala Lumpur",
      companySize: "50-100",
      employeeCount: 75,
      establishedYear: 2020,
      completion: 85,
    },
  });

  console.log("✅ Created customer user:", customerUser.email);
  console.log("✅ Customer user ID:", customerUser.id);

  // Create another test customer
  const customerUser2 = await prisma.user.upsert({
    where: { email: "customer2@example.com" },
    update: {},
    create: {
      email: "customer2@example.com",
      password: hashedPassword,
      name: "Another Customer",
      phone: "987654321",
      role: ["CUSTOMER"],
      kycStatus: "active",
      isVerified: true,
    },
  });

  await prisma.customerProfile.upsert({
    where: { userId: customerUser2.id },
    update: {},
    create: {
      userId: customerUser2.id,
      description: "Another test customer company",
      industry: "Finance",
      location: "Selangor",
      companySize: "10-50",
      employeeCount: 25,
      establishedYear: 2018,
      completion: 70,
    },
  });

  console.log("✅ Created second customer user:", customerUser2.email);
  console.log("✅ Second customer user ID:", customerUser2.id);

  console.log("🎉 Database seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
