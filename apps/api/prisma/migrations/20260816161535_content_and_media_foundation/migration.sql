/*
  Warnings:

  - Added the required column `mediaType` to the `media` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- DropIndex
DROP INDEX "media_postId_key";

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "mediaType" "MediaType" NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "media_postId_sortOrder_idx" ON "media"("postId", "sortOrder");

-- CreateIndex
CREATE INDEX "posts_userId_createdAt_idx" ON "posts"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_socialAccountId_idx" ON "posts"("socialAccountId");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");
