-- CreateEnum
CREATE TYPE "TimeEntryType" AS ENUM ('WORKED', 'INTERNE', 'RTT', 'CP', 'MALADIE', 'AUTRE');

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN "type" "TimeEntryType" NOT NULL DEFAULT 'WORKED';
