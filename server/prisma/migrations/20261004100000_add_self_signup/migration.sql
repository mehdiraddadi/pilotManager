-- AlterTable
ALTER TABLE "users" ADD COLUMN "companyId" TEXT,
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailVerificationTokenHash" TEXT,
ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);

-- Les comptes existants ont été créés par un administrateur : on les considère comme vérifiés
-- et rattachés à la société déjà configurée (singleton jusqu'ici).
UPDATE "users" SET "emailVerified" = true;
UPDATE "users" SET "companyId" = (SELECT "id" FROM "company" ORDER BY "createdAt" ASC LIMIT 1);

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerificationTokenHash_key" ON "users"("emailVerificationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "company_siren_key" ON "company"("siren");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
