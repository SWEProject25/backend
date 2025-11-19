-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('INTERESTS', 'FOLLOWING', 'COMPLETED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "has_completed_following" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_completed_interests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_step" "OnboardingStep" NOT NULL DEFAULT 'INTERESTS';
