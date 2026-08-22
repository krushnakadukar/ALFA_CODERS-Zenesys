ALTER TABLE `attachments`
  MODIFY `attachment_id` VARCHAR(40) NOT NULL,
  ADD COLUMN `storage_provider` VARCHAR(40) NULL DEFAULT 'local',
  ADD COLUMN `file_size_bytes` BIGINT NULL,
  ADD COLUMN `checksum` VARCHAR(128) NULL,
  ADD COLUMN `upload_status` VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `uploaded_by_id` VARCHAR(20) NULL,
  ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `attachments_uploaded_by_id_idx` ON `attachments`(`uploaded_by_id`);
CREATE INDEX `attachments_upload_status_idx` ON `attachments`(`upload_status`);

ALTER TABLE `attachments`
  ADD CONSTRAINT `attachments_uploaded_by_id_fkey`
  FOREIGN KEY (`uploaded_by_id`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;
