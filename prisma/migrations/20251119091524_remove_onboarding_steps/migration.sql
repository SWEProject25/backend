/*
  Warnings:

  - You are about to drop the column `onboarding_step` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "onboarding_step";

-- DropEnum
DROP TYPE "public"."OnboardingStep";
