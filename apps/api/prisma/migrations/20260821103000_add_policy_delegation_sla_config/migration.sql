CREATE TABLE `request_type_configs` (
  `request_type_config_id` VARCHAR(40) NOT NULL,
  `organization_id` VARCHAR(20) NOT NULL,
  `key` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `fields_json` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`request_type_config_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `request_type_configs_organization_id_key_key` ON `request_type_configs`(`organization_id`, `key`);
CREATE INDEX `request_type_configs_organization_id_idx` ON `request_type_configs`(`organization_id`);

CREATE TABLE `routing_policy_configs` (
  `routing_policy_id` VARCHAR(40) NOT NULL,
  `organization_id` VARCHAR(20) NOT NULL,
  `request_type_key` VARCHAR(80) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `conditions_json` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`routing_policy_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `routing_policy_configs_organization_id_idx` ON `routing_policy_configs`(`organization_id`);
CREATE INDEX `routing_policy_configs_request_type_key_idx` ON `routing_policy_configs`(`request_type_key`);

CREATE TABLE `approval_requirement_configs` (
  `approval_requirement_id` VARCHAR(40) NOT NULL,
  `routing_policy_id` VARCHAR(40) NOT NULL,
  `requirement_key` VARCHAR(80) NOT NULL,
  `source` VARCHAR(80) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `step_sequence` INTEGER NOT NULL,
  `mode` VARCHAR(40) NOT NULL DEFAULT 'Sequential',
  `condition_amount_gt` DECIMAL(12, 2) NULL,
  `condition_duration_days_gt` INTEGER NULL,
  `minimum_approval_limit` DECIMAL(12, 2) NULL,
  `sla_minutes` INTEGER NULL,
  `policy_reasons_json` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (`approval_requirement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `approval_requirement_configs_routing_policy_id_idx` ON `approval_requirement_configs`(`routing_policy_id`);
CREATE INDEX `approval_requirement_configs_source_idx` ON `approval_requirement_configs`(`source`);

ALTER TABLE `approval_requirement_configs`
  ADD CONSTRAINT `approval_requirement_configs_routing_policy_id_fkey`
  FOREIGN KEY (`routing_policy_id`) REFERENCES `routing_policy_configs`(`routing_policy_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `delegation_rules` (
  `delegation_rule_id` VARCHAR(40) NOT NULL,
  `organization_id` VARCHAR(20) NOT NULL,
  `delegator_id` VARCHAR(20) NOT NULL,
  `delegate_id` VARCHAR(20) NOT NULL,
  `start_at` DATETIME(3) NOT NULL,
  `end_at` DATETIME(3) NOT NULL,
  `request_types_json` TEXT NOT NULL,
  `department_id` VARCHAR(20) NULL,
  `reason` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (`delegation_rule_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `delegation_rules_organization_id_idx` ON `delegation_rules`(`organization_id`);
CREATE INDEX `delegation_rules_delegator_id_idx` ON `delegation_rules`(`delegator_id`);
CREATE INDEX `delegation_rules_delegate_id_idx` ON `delegation_rules`(`delegate_id`);

CREATE TABLE `sla_policy_configs` (
  `sla_policy_config_id` VARCHAR(40) NOT NULL,
  `organization_id` VARCHAR(20) NOT NULL,
  `request_type_key` VARCHAR(80) NOT NULL,
  `duration_minutes` INTEGER NOT NULL,
  `reminder_percent` INTEGER NOT NULL DEFAULT 80,
  `escalation_source` VARCHAR(80) NOT NULL DEFAULT 'BUSINESS_UNIT_HEAD',
  `active` BOOLEAN NOT NULL DEFAULT true,

  PRIMARY KEY (`sla_policy_config_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `sla_policy_configs_organization_id_request_type_key_key` ON `sla_policy_configs`(`organization_id`, `request_type_key`);
CREATE INDEX `sla_policy_configs_organization_id_idx` ON `sla_policy_configs`(`organization_id`);
