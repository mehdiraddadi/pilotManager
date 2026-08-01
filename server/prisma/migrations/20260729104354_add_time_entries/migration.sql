-- CreateTable
CREATE TABLE "time_entries" (
                                "id" TEXT NOT NULL,
                                "assignmentId" TEXT NOT NULL,
                                "date" DATE NOT NULL,
                                "quantity" DECIMAL(3,2) NOT NULL,
                                "comment" TEXT,
                                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                "updatedAt" TIMESTAMP(3) NOT NULL,

                                CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_assignmentId_date_key" ON "time_entries"("assignmentId", "date");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
