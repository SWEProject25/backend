/*
  Warnings:

  - You are about to drop the column `userId` on the `email_verification` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_email]` on the table `email_verification` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_email` to the `email_verification` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "email_verification" DROP CONSTRAINT "email_verification_userId_fkey";

-- AlterTable
ALTER TABLE "email_verification" DROP COLUMN "userId",
ADD COLUMN     "user_email" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_user_email_key" ON "email_verification"("user_email");

-- AddForeignKey
ALTER TABLE "email_verification" ADD CONSTRAINT "email_verification_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
