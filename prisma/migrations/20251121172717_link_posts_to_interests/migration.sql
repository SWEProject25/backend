-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "interest_id" INTEGER;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
