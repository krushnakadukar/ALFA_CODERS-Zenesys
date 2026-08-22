CREATE TABLE `sla_events` (
  `sla_event_id` VARCHAR(40) NOT NULL,
  `request_id` VARCHAR(20) NOT NULL,
  `approval_chain_step_id` VARCHAR(40) NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `event_at` DATETIME(3) NOT NULL,
  `deadline_at` DATETIME(3) NOT NULL,
  `actor_id` VARCHAR(20) NULL,
  `details` TEXT NULL,

  PRIMARY KEY (`sla_event_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `sla_events_request_id_idx` ON `sla_events`(`request_id`);
CREATE INDEX `sla_events_approval_chain_step_id_idx` ON `sla_events`(`approval_chain_step_id`);
CREATE INDEX `sla_events_event_type_idx` ON `sla_events`(`event_type`);

ALTER TABLE `sla_events`
  ADD CONSTRAINT `sla_events_request_id_fkey`
  FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
