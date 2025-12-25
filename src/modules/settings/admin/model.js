// adminSettings/model.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAdminSettings = async () => {
  let settings = await prisma.adminSettings.findFirst();

  if (!settings) {
    // create initial default settings
    settings = await prisma.adminSettings.create({
      data: {
        platformName: "TechConnect",
        platformDescription: "Malaysia's Premier ICT Service Platform",
        supportEmail: "support@techconnect.my",
        contactPhone: "+60312345678",
        platformUrl: "https://techconnect.my",

        platformCommission: 5,
        withdrawalFee: 0.5,
        minimumWithdrawal: 100,
        paymentProcessingTime: 3,

        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        smtpUsername: "noreply@techconnect.my",
        smtpPassword: "",

        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        marketingEmails: true,

        twoFactorRequired: false,
        sessionTimeout: 30,
        passwordMinLength: 8,
        maxLoginAttempts: 5,

        maintenanceMode: false,
        newRegistrations: true,
        projectCreation: true,
        paymentProcessing: true,
      },
    });
  }

  // ✅ return the settings (either existing or newly created)
  return settings;
};


export const updateAdminSettings = async (data) => {
  // check if settings exist first
  const existing = await prisma.adminSettings.findFirst();

  if (existing) {
    return await prisma.adminSettings.update({
      where: { id: existing.id },
      data,
    });
  } else {
    return await prisma.adminSettings.create({
      data,
    });
  }
};

