CREATE TABLE `ai_suggestions` (
  `ai_suggestion_id` VARCHAR(40) NOT NULL,
  `organization_id` VARCHAR(20) NOT NULL,
  `employee_id` VARCHAR(20) NULL,
  `request_id` VARCHAR(20) NULL,
  `provider` VARCHAR(80) NOT NULL,
  `model` VARCHAR(120) NOT NULL,
  `capability` VARCHAR(80) NOT NULL,
  `prompt` TEXT NOT NULL,
  `output_json` TEXT NOT NULL,
  `confidence` DECIMAL(5, 4) NULL,
  `advisory_only` BOOLEAN NOT NULL DEFAULT true,
  `validation_status` VARCHAR(40) NOT NULL,
  `validation_errors_json` TEXT NULL,
  `accepted` BOOLEAN NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`ai_suggestion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ai_suggestions_organization_id_idx` ON `ai_suggestions`(`organization_id`);
CREATE INDEX `ai_suggestions_employee_id_idx` ON `ai_suggestions`(`employee_id`);
CREATE INDEX `ai_suggestions_request_id_idx` ON `ai_suggestions`(`request_id`);

ALTER TABLE `ai_suggestions`
  ADD CONSTRAINT `ai_suggestions_request_id_fkey`
  FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE SET NULL ON UPDATE CASCADE;
