/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - The required column `publicId` was added to the `Order` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE `Order` ADD COLUMN `publicId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Order_publicId_key` ON `Order`(`publicId`);
