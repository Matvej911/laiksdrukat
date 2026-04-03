-- CreateTable
CREATE TABLE `Upload` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('STAMP_ORDER', 'CONTACT_FORM', 'ADMIN_PRODUCT', 'GALLERY') NOT NULL,
    `sourceRef` VARCHAR(191) NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `subdir` VARCHAR(191) NOT NULL,
    `relativePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NULL,
    `size` INTEGER NOT NULL,
    `isPrivate` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Upload_token_key`(`token`),
    UNIQUE INDEX `Upload_relativePath_key`(`relativePath`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
