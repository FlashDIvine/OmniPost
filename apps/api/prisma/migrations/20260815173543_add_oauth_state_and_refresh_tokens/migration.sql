-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");

-- AddForeignKey
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
