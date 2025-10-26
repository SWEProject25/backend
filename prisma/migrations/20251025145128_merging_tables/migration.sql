/*
  Warnings:

  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `birth_date` on table `profiles` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "profiles" ALTER COLUMN "birth_date" SET NOT NULL;
