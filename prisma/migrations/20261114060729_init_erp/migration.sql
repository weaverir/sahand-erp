-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RAW_MATERIAL', 'COMPONENT', 'FINISHED_GOOD', 'SEMI_FINISHED', 'PACKAGING', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('PIECE', 'METER', 'KILOGRAM', 'GRAM', 'LITER', 'BOX', 'ROLL', 'SET');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'QUARANTINE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BatchQualityStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'SALES_SHIPMENT', 'RETURN', 'REVERSAL');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionRunStatus" AS ENUM ('IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QCStage" AS ENUM ('INCOMING', 'IN_PROCESS', 'FINAL');

-- CreateEnum
CREATE TYPE "QCResult" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "itemType" "ItemType" NOT NULL,
    "baseUnit" "UnitOfMeasure" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "supplierBatchNumber" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "qualityStatus" "BatchQualityStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "batchId" TEXT,
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "sourceLocationId" TEXT,
    "destinationLocationId" TEXT,
    "movementType" "MovementType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "description" TEXT,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductProfile" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "connectorFrom" TEXT,
    "connectorTo" TEXT,
    "cableLengthMm" INTEGER,
    "conductorMaterial" TEXT,
    "jacketMaterial" TEXT,
    "ratedPowerW" DECIMAL(10,2),
    "ratedCurrentA" DECIMAL(10,2),
    "supportsData" BOOLEAN NOT NULL DEFAULT false,
    "hasChip" BOOLEAN NOT NULL DEFAULT false,
    "chipModel" TEXT,
    "technicalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomVersion" (
    "id" TEXT NOT NULL,
    "productProfileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "bomVersionId" TEXT NOT NULL,
    "componentItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "wastePercentage" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingVersion" (
    "id" TEXT NOT NULL,
    "productProfileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingStep" (
    "id" TEXT NOT NULL,
    "routingVersionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operationCode" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "workCenterCode" TEXT,
    "setupTimeMinutes" DECIMAL(10,2),
    "standardTimeMinutes" DECIMAL(10,2),
    "instructions" TEXT,
    "requiresQC" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoutingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "productProfileId" TEXT NOT NULL,
    "bomVersionId" TEXT NOT NULL,
    "routingVersionId" TEXT NOT NULL,
    "salesOrderLineId" TEXT,
    "plannedQuantity" DECIMAL(18,4) NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "productSnapshot" JSONB,
    "bomSnapshot" JSONB,
    "routingSnapshot" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "status" "ProductionRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOperation" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operationCode" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "workCenterCode" TEXT,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "plannedQuantity" DECIMAL(18,4),
    "completedQuantity" DECIMAL(18,4),
    "rejectedQuantity" DECIMAL(18,4),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "operatorUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialConsumption" (
    "id" TEXT NOT NULL,
    "productionOperationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "stockMovementId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOutput" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "rejectedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stockMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QCInspection" (
    "id" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productionOperationId" TEXT,
    "stage" "QCStage" NOT NULL,
    "result" "QCResult" NOT NULL DEFAULT 'PENDING',
    "batchId" TEXT,
    "inspectedQuantity" DECIMAL(18,4),
    "passedQuantity" DECIMAL(18,4),
    "failedQuantity" DECIMAL(18,4),
    "inspectorUserId" TEXT,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defectDescription" TEXT,
    "correctiveAction" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QCInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "description" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "currencyCode" TEXT NOT NULL DEFAULT 'IRR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationId" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedDeliveryDate" TIMESTAMP(3),
    "currencyCode" TEXT NOT NULL DEFAULT 'IRR',
    "shippingAddress" TEXT,
    "billingAddress" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'DRAFT',
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackingNumber" TEXT,
    "shippingNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryLine" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchId" TEXT,
    "sourceLocationId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "stockMovementId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name");

-- CreateIndex
CREATE INDEX "Item_itemType_idx" ON "Item"("itemType");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "StockLocation_warehouseId_idx" ON "StockLocation"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_warehouseId_code_key" ON "StockLocation"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "Batch_batchNumber_idx" ON "Batch"("batchNumber");

-- CreateIndex
CREATE INDEX "Batch_qualityStatus_idx" ON "Batch"("qualityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_itemId_batchNumber_key" ON "Batch"("itemId", "batchNumber");

-- CreateIndex
CREATE INDEX "StockBalance_itemId_locationId_idx" ON "StockBalance"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "StockBalance_batchId_idx" ON "StockBalance"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_itemId_locationId_batchId_status_key" ON "StockBalance"("itemId", "locationId", "batchId", "status");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");

-- CreateIndex
CREATE INDEX "StockMovement_movementType_idx" ON "StockMovement"("movementType");

-- CreateIndex
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "StockMovement_postedAt_idx" ON "StockMovement"("postedAt");

-- CreateIndex
CREATE INDEX "StockReservation_itemId_locationId_idx" ON "StockReservation"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "StockReservation_referenceType_referenceId_idx" ON "StockReservation"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "StockReservation_batchId_idx" ON "StockReservation"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_receiptNumber_key" ON "GoodsReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_itemId_idx" ON "GoodsReceiptLine"("itemId");

-- CreateIndex
CREATE INDEX "GoodsReceiptLine_batchId_idx" ON "GoodsReceiptLine"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLine_receiptId_lineNumber_key" ON "GoodsReceiptLine"("receiptId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductProfile_itemId_key" ON "ProductProfile"("itemId");

-- CreateIndex
CREATE INDEX "BomVersion_productProfileId_status_idx" ON "BomVersion"("productProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BomVersion_productProfileId_versionNumber_key" ON "BomVersion"("productProfileId", "versionNumber");

-- CreateIndex
CREATE INDEX "BomLine_componentItemId_idx" ON "BomLine"("componentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BomLine_bomVersionId_sequence_key" ON "BomLine"("bomVersionId", "sequence");

-- CreateIndex
CREATE INDEX "RoutingVersion_productProfileId_status_idx" ON "RoutingVersion"("productProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingVersion_productProfileId_versionNumber_key" ON "RoutingVersion"("productProfileId", "versionNumber");

-- CreateIndex
CREATE INDEX "RoutingStep_operationCode_idx" ON "RoutingStep"("operationCode");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingStep_routingVersionId_sequence_key" ON "RoutingStep"("routingVersionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_orderNumber_key" ON "WorkOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_productProfileId_idx" ON "WorkOrder"("productProfileId");

-- CreateIndex
CREATE INDEX "WorkOrder_salesOrderLineId_idx" ON "WorkOrder"("salesOrderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRun_runNumber_key" ON "ProductionRun"("runNumber");

-- CreateIndex
CREATE INDEX "ProductionRun_workOrderId_idx" ON "ProductionRun"("workOrderId");

-- CreateIndex
CREATE INDEX "ProductionRun_status_idx" ON "ProductionRun"("status");

-- CreateIndex
CREATE INDEX "ProductionOperation_status_idx" ON "ProductionOperation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOperation_productionRunId_sequence_key" ON "ProductionOperation"("productionRunId", "sequence");

-- CreateIndex
CREATE INDEX "MaterialConsumption_itemId_batchId_idx" ON "MaterialConsumption"("itemId", "batchId");

-- CreateIndex
CREATE INDEX "MaterialConsumption_productionOperationId_idx" ON "MaterialConsumption"("productionOperationId");

-- CreateIndex
CREATE INDEX "ProductionOutput_itemId_batchId_idx" ON "ProductionOutput"("itemId", "batchId");

-- CreateIndex
CREATE INDEX "ProductionOutput_productionRunId_idx" ON "ProductionOutput"("productionRunId");

-- CreateIndex
CREATE UNIQUE INDEX "QCInspection_inspectionNumber_key" ON "QCInspection"("inspectionNumber");

-- CreateIndex
CREATE INDEX "QCInspection_workOrderId_stage_idx" ON "QCInspection"("workOrderId", "stage");

-- CreateIndex
CREATE INDEX "QCInspection_batchId_idx" ON "QCInspection"("batchId");

-- CreateIndex
CREATE INDEX "QCInspection_result_idx" ON "QCInspection"("result");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_nationalId_idx" ON "Customer"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quoteNumber_key" ON "Quotation"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_issueDate_idx" ON "Quotation"("issueDate");

-- CreateIndex
CREATE INDEX "QuotationLine_itemId_idx" ON "QuotationLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationLine_quotationId_lineNumber_key" ON "QuotationLine"("quotationId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNumber_key" ON "SalesOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_quotationId_key" ON "SalesOrder"("quotationId");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_orderDate_idx" ON "SalesOrder"("orderDate");

-- CreateIndex
CREATE INDEX "SalesOrderLine_itemId_idx" ON "SalesOrderLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderLine_salesOrderId_lineNumber_key" ON "SalesOrderLine"("salesOrderId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");

-- CreateIndex
CREATE INDEX "Delivery_salesOrderId_idx" ON "Delivery"("salesOrderId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_deliveryDate_idx" ON "Delivery"("deliveryDate");

-- CreateIndex
CREATE INDEX "DeliveryLine_deliveryId_idx" ON "DeliveryLine"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryLine_salesOrderLineId_idx" ON "DeliveryLine"("salesOrderLineId");

-- CreateIndex
CREATE INDEX "DeliveryLine_itemId_batchId_idx" ON "DeliveryLine"("itemId", "batchId");

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductProfile" ADD CONSTRAINT "ProductProfile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomVersion" ADD CONSTRAINT "BomVersion_productProfileId_fkey" FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BomVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingVersion" ADD CONSTRAINT "RoutingVersion_productProfileId_fkey" FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingStep" ADD CONSTRAINT "RoutingStep_routingVersionId_fkey" FOREIGN KEY ("routingVersionId") REFERENCES "RoutingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_productProfileId_fkey" FOREIGN KEY ("productProfileId") REFERENCES "ProductProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BomVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_routingVersionId_fkey" FOREIGN KEY ("routingVersionId") REFERENCES "RoutingVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "ProductionOperation_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_productionOperationId_fkey" FOREIGN KEY ("productionOperationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QCInspection" ADD CONSTRAINT "QCInspection_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QCInspection" ADD CONSTRAINT "QCInspection_productionOperationId_fkey" FOREIGN KEY ("productionOperationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLine" ADD CONSTRAINT "DeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLine" ADD CONSTRAINT "DeliveryLine_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLine" ADD CONSTRAINT "DeliveryLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
