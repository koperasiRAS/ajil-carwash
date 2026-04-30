-- ============================================================
-- Migration: simplify_schema
-- Purpose: Remove unused tables, add plat_nomor to Transaction
-- Tables removed: Shift, Service, StockItem, StockLog, AuditLog, Expense
-- ============================================================

-- 1. Drop foreign key on TransactionItem (serviceId)
ALTER TABLE "TransactionItem" DROP CONSTRAINT IF EXISTS "TransactionItem_serviceId_fkey";

-- 2. Drop cascade order matters: child tables first
DROP TABLE IF EXISTS "StockLog" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Expense" CASCADE;
DROP TABLE IF EXISTS "TransactionItem" CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS "StockItem" CASCADE;
DROP TABLE IF EXISTS "Service" CASCADE;
DROP TABLE IF EXISTS "Shift" CASCADE;

-- 3. Drop enums that are no longer needed
DROP TYPE IF EXISTS "StockLogType" CASCADE;
DROP TYPE IF EXISTS "ExpenseCategory" CASCADE;
DROP TYPE IF EXISTS "ShiftStatus" CASCADE;

-- 4. Keep User table — add voidedTx relation is handled separately

-- ============================================================
-- Recreate Transaction table (new schema)
-- ============================================================
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "kasirId" TEXT NOT NULL,
    "platNomor" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT,
    "vehicleType" "VehicleType" NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "paymentAmount" INTEGER NOT NULL,
    "change" INTEGER NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "voidReason" TEXT,
    "voidById" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- 5. Recreate TransactionItem table (no service FK)
CREATE TABLE "TransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "subtotal" INTEGER NOT NULL,
    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- 6. Recreate indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_invoiceNumber_key" ON "Transaction"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Transaction_kasirId_idx" ON "Transaction"("kasirId");
CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_status_idx" ON "Transaction"("status");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_kasirId_fkey"
    FOREIGN KEY ("kasirId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_voidById_fkey"
    FOREIGN KEY ("voidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
