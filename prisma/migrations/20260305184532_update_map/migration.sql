/*
  Warnings:

  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Certification" DROP CONSTRAINT "Certification_profileId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutMethod" DROP CONSTRAINT "PayoutMethod_providerProfileId_fkey";

-- DropForeignKey
ALTER TABLE "PerformanceStat" DROP CONSTRAINT "PerformanceStat_profileId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectPortfolio" DROP CONSTRAINT "ProjectPortfolio_profileId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_userId_fkey";

-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "major" VARCHAR(255),
    "location" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "availability" VARCHAR(50),
    "languages" TEXT[],
    "website" TEXT,
    "portfolioLinks" TEXT[],
    "profile_image_url" TEXT,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_projects" INTEGER NOT NULL DEFAULT 0,
    "total_earnings" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "response_time" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "completion" INTEGER,
    "skills" TEXT[],
    "yearsExperience" INTEGER,
    "minimum_project_budget" DECIMAL(10,2),
    "maximum_project_budget" DECIMAL(10,2),
    "preferred_project_duration" VARCHAR(50),
    "work_preference" VARCHAR(50) NOT NULL DEFAULT 'remote',
    "team_size" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "ProviderProfile"("userId");

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutMethod" ADD CONSTRAINT "PayoutMethod_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceStat" ADD CONSTRAINT "PerformanceStat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPortfolio" ADD CONSTRAINT "ProjectPortfolio_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
