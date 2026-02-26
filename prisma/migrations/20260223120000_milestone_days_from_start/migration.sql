-- AlterTable: ServiceRequestMilestone - add days_from_start
ALTER TABLE "service_request_milestones" ADD COLUMN "days_from_start" INTEGER;

-- AlterTable: ProposalMilestone - add days_from_start
ALTER TABLE "proposal_milestones" ADD COLUMN "days_from_start" INTEGER;

-- AlterTable: Project - add started_at
ALTER TABLE "Project" ADD COLUMN "started_at" TIMESTAMP(3);

-- AlterTable: Milestone - add days_from_start
ALTER TABLE "Milestone" ADD COLUMN "days_from_start" INTEGER;
