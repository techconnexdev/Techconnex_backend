/**
 * Prisma seed script: creates 5 providers and 5 companies (customers) with full profile data.
 * Run: npx prisma db seed   or   npm run seed
 *
 * All seeded users share password: password123
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for seed script.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SEED_PASSWORD = "password123";

const providerSeeds = [
  {
    email: "provider1@example.com",
    name: "Ahmad Rizal",
    phone: "+60123456701",
    profile: {
      bio: "Full-stack developer with 8+ years building web and mobile apps. Specialized in React, Node.js, and cloud architecture.",
      major: "Senior Full-Stack Developer",
      location: "Kuala Lumpur, Malaysia",
      hourlyRate: 120,
      availability: "full_time",
      languages: ["English", "Bahasa Malaysia"],
      website: "https://ahmadrizal.dev",
      portfolioLinks: ["https://github.com/ahmadrizal", "https://linkedin.com/in/ahmadrizal"],
      profileImageUrl: null,
      rating: 4.85,
      totalReviews: 42,
      totalProjects: 38,
      totalEarnings: 45600,
      viewsCount: 1200,
      successRate: 97.5,
      responseTime: 2,
      isFeatured: true,
      completion: 95,
      skills: ["React", "Node.js", "TypeScript", "PostgreSQL", "AWS"],
      yearsExperience: 8,
      minimumProjectBudget: 2000,
      maximumProjectBudget: 50000,
      preferredProjectDuration: "1-3 months",
      workPreference: "remote",
      teamSize: 1,
    },
  },
  {
    email: "provider2@example.com",
    name: "Sarah Chen",
    phone: "+60123456702",
    profile: {
      bio: "UI/UX designer and front-end developer. Passionate about accessibility and design systems.",
      major: "Lead UI/UX Engineer",
      location: "Penang, Malaysia",
      hourlyRate: 95,
      availability: "full_time",
      languages: ["English", "Mandarin", "Bahasa Malaysia"],
      website: "https://sarahchen.design",
      portfolioLinks: ["https://dribbble.com/sarahchen", "https://behance.net/sarahchen"],
      profileImageUrl: null,
      rating: 4.92,
      totalReviews: 28,
      totalProjects: 25,
      totalEarnings: 28900,
      viewsCount: 890,
      successRate: 100,
      responseTime: 1,
      isFeatured: true,
      completion: 88,
      skills: ["Figma", "React", "Tailwind CSS", "Design Systems", "Accessibility"],
      yearsExperience: 6,
      minimumProjectBudget: 1500,
      maximumProjectBudget: 35000,
      preferredProjectDuration: "2-4 weeks",
      workPreference: "remote",
      teamSize: 1,
    },
  },
  {
    email: "provider3@example.com",
    name: "Raj Kumar",
    phone: "+60123456703",
    profile: {
      bio: "DevOps and cloud solutions architect. AWS and GCP certified. Automating infrastructure and CI/CD pipelines.",
      major: "DevOps Engineer",
      location: "Selangor, Malaysia",
      hourlyRate: 110,
      availability: "full_time",
      languages: ["English", "Tamil", "Bahasa Malaysia"],
      website: null,
      portfolioLinks: ["https://github.com/rajdevops"],
      profileImageUrl: null,
      rating: 4.78,
      totalReviews: 19,
      totalProjects: 22,
      totalEarnings: 31200,
      viewsCount: 650,
      successRate: 95.5,
      responseTime: 3,
      isFeatured: false,
      completion: 92,
      skills: ["AWS", "Docker", "Kubernetes", "Terraform", "GitLab CI"],
      yearsExperience: 7,
      minimumProjectBudget: 3000,
      maximumProjectBudget: 60000,
      preferredProjectDuration: "1-6 months",
      workPreference: "remote",
      teamSize: 1,
    },
  },
  {
    email: "provider4@example.com",
    name: "Nurul Izzati",
    phone: "+60123456704",
    profile: {
      bio: "Mobile app developer (React Native, Flutter). Delivered 30+ apps for startups and enterprises.",
      major: "Mobile App Developer",
      location: "Johor Bahru, Malaysia",
      hourlyRate: 88,
      availability: "full_time",
      languages: ["English", "Bahasa Malaysia"],
      website: "https://nurulapps.com",
      portfolioLinks: ["https://github.com/nurulapps", "https://play.google.com/store/apps/developer/nurul"],
      profileImageUrl: null,
      rating: 4.65,
      totalReviews: 35,
      totalProjects: 32,
      totalEarnings: 22400,
      viewsCount: 720,
      successRate: 93,
      responseTime: 4,
      isFeatured: false,
      completion: 85,
      skills: ["React Native", "Flutter", "Firebase", "REST APIs"],
      yearsExperience: 5,
      minimumProjectBudget: 1000,
      maximumProjectBudget: 28000,
      preferredProjectDuration: "1-2 months",
      workPreference: "hybrid",
      teamSize: 1,
    },
  },
  {
    email: "provider5@example.com",
    name: "David Wong",
    phone: "+60123456705",
    profile: {
      bio: "Data engineer and ML pipeline specialist. Building scalable data platforms and analytics solutions.",
      major: "Data Engineer",
      location: "Kuala Lumpur, Malaysia",
      hourlyRate: 130,
      availability: "full_time",
      languages: ["English", "Mandarin"],
      website: null,
      portfolioLinks: ["https://github.com/davidwong-data", "https://linkedin.com/in/davidwong"],
      profileImageUrl: null,
      rating: 4.9,
      totalReviews: 15,
      totalProjects: 12,
      totalEarnings: 18900,
      viewsCount: 420,
      successRate: 100,
      responseTime: 2,
      isFeatured: true,
      completion: 90,
      skills: ["Python", "Spark", "Airflow", "BigQuery", "TensorFlow"],
      yearsExperience: 6,
      minimumProjectBudget: 5000,
      maximumProjectBudget: 80000,
      preferredProjectDuration: "2-4 months",
      workPreference: "remote",
      teamSize: 1,
    },
  },
];

const companySeeds = [
  {
    email: "company1@example.com",
    name: "TechStart Sdn Bhd",
    phone: "+60387654321",
    profile: {
      description: "Early-stage fintech startup building payment solutions for Southeast Asia.",
      industry: "Fintech",
      location: "Kuala Lumpur, Malaysia",
      website: "https://techstart.my",
      profileImageUrl: null,
      socialLinks: { linkedin: "https://linkedin.com/company/techstart", twitter: "https://twitter.com/techstart_my" },
      languages: ["English", "Bahasa Malaysia"],
      companySize: "11-50",
      employeeCount: 35,
      establishedYear: 2021,
      annualRevenue: 2500000,
      fundingStage: "Series A",
      preferredContractTypes: ["fixed_price", "hourly"],
      averageBudgetRange: "10k-50k",
      remotePolicy: "Hybrid",
      hiringFrequency: "regular",
      categoriesHiringFor: ["Web Development", "Mobile App", "Cloud Services"],
      completion: 80,
      rating: 4.5,
      reviewCount: 12,
      totalSpend: 185000,
      projectsPosted: 15,
      lastActiveAt: new Date(),
      mission: "Democratize payments across SEA.",
      values: ["Innovation", "Transparency", "User-first"],
      benefits: { health: true, remote: true, learning: true },
      mediaGallery: [],
    },
  },
  {
    email: "company2@example.com",
    name: "GreenRetail Holdings",
    phone: "+60387654322",
    profile: {
      description: "E-commerce and retail tech company. Scaling our platform and logistics systems.",
      industry: "E-commerce",
      location: "Selangor, Malaysia",
      website: "https://greenretail.com",
      profileImageUrl: null,
      socialLinks: { linkedin: "https://linkedin.com/company/greenretail" },
      languages: ["English"],
      companySize: "51-200",
      employeeCount: 120,
      establishedYear: 2018,
      annualRevenue: 15000000,
      fundingStage: "Series B",
      preferredContractTypes: ["fixed_price", "retainer"],
      averageBudgetRange: "50k-200k",
      remotePolicy: "Remote",
      hiringFrequency: "regular",
      categoriesHiringFor: ["Web Development", "DevOps", "Data Analytics"],
      completion: 88,
      rating: 4.7,
      reviewCount: 24,
      totalSpend: 420000,
      projectsPosted: 28,
      lastActiveAt: new Date(),
      mission: "Sustainable retail through technology.",
      values: ["Sustainability", "Quality", "Scale"],
      benefits: { health: true, remote: true },
      mediaGallery: [],
    },
  },
  {
    email: "company3@example.com",
    name: "HealthFirst Digital",
    phone: "+60387654323",
    profile: {
      description: "Digital health platform. We build patient and clinic management systems.",
      industry: "HealthTech",
      location: "Penang, Malaysia",
      website: "https://healthfirst.digital",
      profileImageUrl: null,
      socialLinks: null,
      languages: ["English", "Mandarin"],
      companySize: "10-50",
      employeeCount: 28,
      establishedYear: 2020,
      annualRevenue: 1200000,
      fundingStage: "Seed",
      preferredContractTypes: ["fixed_price"],
      averageBudgetRange: "20k-80k",
      remotePolicy: "Hybrid",
      hiringFrequency: "occasional",
      categoriesHiringFor: ["Web Development", "Mobile App", "Cybersecurity"],
      completion: 75,
      rating: 4.6,
      reviewCount: 8,
      totalSpend: 95000,
      projectsPosted: 10,
      lastActiveAt: new Date(),
      mission: "Better health outcomes through digital care.",
      values: ["Compliance", "Privacy", "Reliability"],
      benefits: null,
      mediaGallery: [],
    },
  },
  {
    email: "company4@example.com",
    name: "EduLearn Platform",
    phone: "+60387654324",
    profile: {
      description: "EdTech company providing LMS and content platforms for schools and enterprises.",
      industry: "EdTech",
      location: "Johor, Malaysia",
      website: "https://edulearn.my",
      profileImageUrl: null,
      socialLinks: { linkedin: "https://linkedin.com/company/edulearn", facebook: "https://facebook.com/edulearn" },
      languages: ["English", "Bahasa Malaysia"],
      companySize: "11-50",
      employeeCount: 45,
      establishedYear: 2019,
      annualRevenue: 3800000,
      fundingStage: "Series A",
      preferredContractTypes: ["fixed_price", "hourly"],
      averageBudgetRange: "15k-60k",
      remotePolicy: "Remote",
      hiringFrequency: "regular",
      categoriesHiringFor: ["Web Development", "UI/UX Design", "AI/ML Solutions"],
      completion: 82,
      rating: 4.55,
      reviewCount: 18,
      totalSpend: 210000,
      projectsPosted: 22,
      lastActiveAt: new Date(),
      mission: "Make quality education accessible.",
      values: ["Accessibility", "Innovation", "Impact"],
      benefits: { health: true, remote: true, learning: true },
      mediaGallery: [],
    },
  },
  {
    email: "company5@example.com",
    name: "LogiFlow Solutions",
    phone: "+60387654325",
    profile: {
      description: "Logistics and supply chain software. APIs and dashboards for fleet and warehouse management.",
      industry: "Logistics",
      location: "Kuala Lumpur, Malaysia",
      website: "https://logiflow.io",
      profileImageUrl: null,
      socialLinks: { linkedin: "https://linkedin.com/company/logiflow" },
      languages: ["English"],
      companySize: "51-200",
      employeeCount: 95,
      establishedYear: 2017,
      annualRevenue: 22000000,
      fundingStage: "Series B",
      preferredContractTypes: ["fixed_price", "retainer"],
      averageBudgetRange: "80k-300k",
      remotePolicy: "Hybrid",
      hiringFrequency: "enterprise",
      categoriesHiringFor: ["System Integration", "IoT Solutions", "Data Analytics", "DevOps"],
      completion: 90,
      rating: 4.8,
      reviewCount: 31,
      totalSpend: 680000,
      projectsPosted: 35,
      lastActiveAt: new Date(),
      mission: "Simplify supply chain with technology.",
      values: ["Reliability", "Scale", "Partnership"],
      benefits: { health: true, remote: true, learning: true, bonus: true },
      mediaGallery: [],
    },
  },
];

function mapProviderProfile(profile) {
  return {
    bio: profile.bio ?? null,
    major: profile.major ?? null,
    location: profile.location ?? null,
    hourlyRate: profile.hourlyRate ?? null,
    availability: profile.availability ?? null,
    languages: profile.languages ?? [],
    website: profile.website ?? null,
    portfolioLinks: profile.portfolioLinks ?? [],
    profileImageUrl: profile.profileImageUrl ?? null,
    rating: new Prisma.Decimal(profile.rating ?? 0),
    totalReviews: profile.totalReviews ?? 0,
    totalProjects: profile.totalProjects ?? 0,
    totalEarnings: new Prisma.Decimal(profile.totalEarnings ?? 0),
    viewsCount: profile.viewsCount ?? 0,
    successRate: new Prisma.Decimal(profile.successRate ?? 0),
    responseTime: profile.responseTime ?? 0,
    isFeatured: profile.isFeatured ?? false,
    completion: profile.completion ?? null,
    skills: profile.skills ?? [],
    yearsExperience: profile.yearsExperience ?? null,
    minimumProjectBudget: profile.minimumProjectBudget != null ? new Prisma.Decimal(profile.minimumProjectBudget) : null,
    maximumProjectBudget: profile.maximumProjectBudget != null ? new Prisma.Decimal(profile.maximumProjectBudget) : null,
    preferredProjectDuration: profile.preferredProjectDuration ?? null,
    workPreference: profile.workPreference ?? "remote",
    teamSize: profile.teamSize ?? 1,
  };
}

function mapCustomerProfile(profile) {
  return {
    description: profile.description ?? null,
    industry: profile.industry ?? null,
    location: profile.location ?? null,
    website: profile.website ?? null,
    profileImageUrl: profile.profileImageUrl ?? null,
    socialLinks: profile.socialLinks ?? null,
    languages: profile.languages ?? [],
    companySize: profile.companySize ?? null,
    employeeCount: profile.employeeCount ?? null,
    establishedYear: profile.establishedYear ?? null,
    annualRevenue: profile.annualRevenue != null ? new Prisma.Decimal(profile.annualRevenue) : null,
    fundingStage: profile.fundingStage ?? null,
    preferredContractTypes: profile.preferredContractTypes ?? [],
    averageBudgetRange: profile.averageBudgetRange ?? null,
    remotePolicy: profile.remotePolicy ?? null,
    hiringFrequency: profile.hiringFrequency ?? null,
    categoriesHiringFor: profile.categoriesHiringFor ?? [],
    completion: profile.completion ?? null,
    rating: profile.rating ?? 0,
    reviewCount: profile.reviewCount ?? 0,
    totalSpend: profile.totalSpend != null ? new Prisma.Decimal(profile.totalSpend) : null,
    projectsPosted: profile.projectsPosted ?? 0,
    lastActiveAt: profile.lastActiveAt ?? null,
    mission: profile.mission ?? null,
    values: profile.values ?? [],
    benefits: profile.benefits ?? null,
    mediaGallery: profile.mediaGallery ?? [],
  };
}

const defaultSettings = {
  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: true,
  projectUpdates: true,
  marketingEmails: false,
  weeklyReports: true,
  profileVisibility: "public",
  showEmail: false,
  showPhone: false,
  allowMessages: true,
};

async function seedProviders(hashedPassword) {
  const created = [];
  for (const seed of providerSeeds) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        password: hashedPassword,
        name: seed.name,
        phone: seed.phone,
        role: ["PROVIDER"],
        kycStatus: "pending_verification",
        isVerified: false,
        status: "ACTIVE",
        providerProfile: {
          create: mapProviderProfile(seed.profile),
        },
      },
      include: { providerProfile: true },
    });
    await prisma.settings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, ...defaultSettings },
    });
    created.push(user);
    console.log("  ✅ Provider:", user.email, "|", user.providerProfile?.major);
  }
  return created;
}

async function seedCompanies(hashedPassword) {
  const created = [];
  for (const seed of companySeeds) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        password: hashedPassword,
        name: seed.name,
        phone: seed.phone,
        role: ["CUSTOMER"],
        kycStatus: "pending_verification",
        isVerified: false,
        status: "ACTIVE",
        customerProfile: {
          create: mapCustomerProfile(seed.profile),
        },
      },
      include: { customerProfile: true },
    });
    await prisma.settings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, ...defaultSettings },
    });
    created.push(user);
    console.log("  ✅ Company:", user.email, "|", user.customerProfile?.industry);
  }
  return created;
}

async function main() {
  console.log("🌱 Starting database seed...\n");
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("📌 Seeding 5 providers (role: PROVIDER)...");
  await seedProviders(hashedPassword);

  console.log("\n📌 Seeding 5 companies (role: CUSTOMER)...");
  await seedCompanies(hashedPassword);

  console.log("\n🎉 Seed completed!");
  console.log("   All seeded users use password:", SEED_PASSWORD);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
