CREATE TABLE `approval_chain_steps` (
  `approval_chain_step_id` VARCHAR(40) NOT NULL,
  `request_id` VARCHAR(20) NOT NULL,
  `step_sequence` INTEGER NOT NULL,
  `approver_id` VARCHAR(20) NOT NULL,
  `approver_source` VARCHAR(80) NOT NULL,
  `role_label` VARCHAR(120) NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  `reason` TEXT NOT NULL,
  `sla_deadline` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `action_at` DATETIME(3) NULL,

  PRIMARY KEY (`approval_chain_step_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `approval_chain_steps_request_id_idx` ON `approval_chain_steps`(`request_id`);
CREATE INDEX `approval_chain_steps_approver_id_idx` ON `approval_chain_steps`(`approver_id`);
CREATE INDEX `approval_chain_steps_status_idx` ON `approval_chain_steps`(`status`);

ALTER TABLE `approval_chain_steps`
  ADD CONSTRAINT `approval_chain_steps_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `approval_chain_steps`
  ADD CONSTRAINT `approval_chain_steps_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `routing_decision_logs` (
  `routing_decision_log_id` VARCHAR(40) NOT NULL,
  `request_id` VARCHAR(20) NOT NULL,
  `routing_timestamp` DATETIME(3) NOT NULL,
  `routing_engine_version` VARCHAR(80) NOT NULL,
  `policy_id` VARCHAR(40) NULL,
  `policy_version` INTEGER NOT NULL,
  `status` VARCHAR(40) NOT NULL,
  `requester_context_json` TEXT NOT NULL,
  `candidate_approvers_json` TEXT NOT NULL,
  `rejected_candidates_json` TEXT NOT NULL,
  `selected_approvers_json` TEXT NOT NULL,
  `rules_evaluated_json` TEXT NOT NULL,
  `exception_reason` TEXT NULL,

  PRIMARY KEY (`routing_decision_log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `routing_decision_logs_request_id_idx` ON `routing_decision_logs`(`request_id`);
CREATE INDEX `routing_decision_logs_status_idx` ON `routing_decision_logs`(`status`);

ALTER TABLE `routing_decision_logs`
  ADD CONSTRAINT `routing_decision_logs_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
