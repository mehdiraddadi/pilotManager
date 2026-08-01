-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "intermediaryId" TEXT;

-- CreateTable
CREATE TABLE "intermediaries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intermediaries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_intermediaryId_fkey" FOREIGN KEY ("intermediaryId") REFERENCES "intermediaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
