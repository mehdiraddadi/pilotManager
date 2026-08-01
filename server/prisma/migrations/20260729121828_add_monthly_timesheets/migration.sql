-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'VALIDATED', 'REJECTED');

-- CreateTable
CREATE TABLE "monthly_timesheets" (
                                      "id" TEXT NOT NULL,
                                      "userId" TEXT NOT NULL,
                                      "month" DATE NOT NULL,
                                      "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
                                      "comment" TEXT,
                                      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                      "updatedAt" TIMESTAMP(3) NOT NULL,

                                      CONSTRAINT "monthly_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_timesheets_userId_month_key" ON "monthly_timesheets"("userId", "month");

-- AddForeignKey
ALTER TABLE "monthly_timesheets" ADD CONSTRAINT "monthly_timesheets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
