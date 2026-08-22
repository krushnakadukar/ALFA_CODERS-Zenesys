CREATE TABLE `user_roles` (
  `user_role_id` VARCHAR(40) NOT NULL,
  `user_id` VARCHAR(40) NOT NULL,
  `role_id` VARCHAR(20) NOT NULL,
  `organization_id` VARCHAR(20) NOT NULL,
  `business_unit` VARCHAR(80) NULL,
  `department_id` VARCHAR(20) NULL,
  `team_id` VARCHAR(20) NULL,
  `resource_id` VARCHAR(20) NULL,
  `workflow_id` VARCHAR(20) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`user_role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `user_roles_organization_id_idx` ON `user_roles`(`organization_id`);
CREATE INDEX `user_roles_user_id_idx` ON `user_roles`(`user_id`);
CREATE INDEX `user_roles_role_id_idx` ON `user_roles`(`role_id`);
CREATE INDEX `user_roles_department_id_idx` ON `user_roles`(`department_id`);
CREATE INDEX `user_roles_team_id_idx` ON `user_roles`(`team_id`);
CREATE UNIQUE INDEX `user_roles_scope_unique`
  ON `user_roles`(`user_id`, `role_id`, `organization_id`, `business_unit`, `department_id`, `team_id`, `resource_id`, `workflow_id`);

ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`team_id`) ON DELETE SET NULL ON UPDATE CASCADE;
