/*
  Warnings:

  - You are about to drop the column `content` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `messages` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user1Id,user2Id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `text` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "messages" DROP COLUMN "content",
DROP COLUMN "isDeleted",
ADD COLUMN     "isDeletedU1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeletedU2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSeen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "text" VARCHAR(1000) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_user1Id_user2Id_key" ON "conversations"("user1Id", "user2Id");
