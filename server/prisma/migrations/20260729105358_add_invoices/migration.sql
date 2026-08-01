-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- CreateTable
CREATE TABLE "invoices" (
                            "id" TEXT NOT NULL,
                            "number" TEXT NOT NULL,
                            "clientId" TEXT NOT NULL,
                            "periodMonth" DATE NOT NULL,
                            "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
                            "totalAmount" DECIMAL(12,2) NOT NULL,
                            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            "updatedAt" TIMESTAMP(3) NOT NULL,

                            CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
                                 "id" TEXT NOT NULL,
                                 "invoiceId" TEXT NOT NULL,
                                 "assignmentId" TEXT NOT NULL,
                                 "description" TEXT NOT NULL,
                                 "quantity" DECIMAL(6,2) NOT NULL,
                                 "unitPrice" DECIMAL(10,2) NOT NULL,
                                 "amount" DECIMAL(12,2) NOT NULL,

                                 CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
