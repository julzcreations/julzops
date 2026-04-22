-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "anthropicWorkspaceId" TEXT;

-- CreateTable
CREATE TABLE "AnthropicCost" (
    "costDate" DATE NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnthropicCost_pkey" PRIMARY KEY ("costDate","workspaceId","description")
);

-- CreateIndex
CREATE INDEX "AnthropicCost_costDate_idx" ON "AnthropicCost"("costDate");

-- CreateIndex
CREATE INDEX "AnthropicCost_workspaceId_costDate_idx" ON "AnthropicCost"("workspaceId", "costDate");

-- CreateIndex
CREATE UNIQUE INDEX "Project_anthropicWorkspaceId_key" ON "Project"("anthropicWorkspaceId");

