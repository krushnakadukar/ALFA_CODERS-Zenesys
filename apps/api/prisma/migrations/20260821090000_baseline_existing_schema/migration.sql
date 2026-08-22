-- CreateTable
CREATE TABLE `approvals` (
    `approval_id` VARCHAR(20) NOT NULL,
    `request_id` VARCHAR(20) NOT NULL,
    `approver_id` VARCHAR(20) NOT NULL,
    `stage` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `action_at` DATETIME(3) NULL,
    `comments` TEXT NULL,

    INDEX `approvals_approver_id_idx`(`approver_id` ASC),
    INDEX `approvals_request_id_idx`(`request_id` ASC),
    PRIMARY KEY (`approval_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attachments` (
    `attachment_id` VARCHAR(20) NOT NULL,
    `request_id` VARCHAR(20) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NULL,
    `storage_path` VARCHAR(500) NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT false,

    INDEX `attachments_request_id_idx`(`request_id` ASC),
    PRIMARY KEY (`attachment_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `audit_id` VARCHAR(20) NOT NULL,
    `request_id` VARCHAR(20) NULL,
    `actor_id` VARCHAR(20) NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `event_at` DATETIME(3) NOT NULL,
    `details` TEXT NULL,

    INDEX `audit_logs_actor_id_idx`(`actor_id` ASC),
    INDEX `audit_logs_request_id_idx`(`request_id` ASC),
    PRIMARY KEY (`audit_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `department_id` VARCHAR(20) NOT NULL,
    `organization_id` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `group_name` VARCHAR(80) NOT NULL,
    `executive_role` VARCHAR(80) NOT NULL,

    INDEX `departments_organization_id_idx`(`organization_id` ASC),
    PRIMARY KEY (`department_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_skills` (
    `employee_skill_id` VARCHAR(20) NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `skill_id` VARCHAR(20) NOT NULL,
    `proficiency` INTEGER NOT NULL,

    INDEX `employee_skills_employee_id_idx`(`employee_id` ASC),
    INDEX `employee_skills_skill_id_idx`(`skill_id` ASC),
    PRIMARY KEY (`employee_skill_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `employee_id` VARCHAR(20) NOT NULL,
    `organization_id` VARCHAR(20) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `role_id` VARCHAR(20) NOT NULL,
    `department_id` VARCHAR(20) NULL,
    `team_id` VARCHAR(20) NULL,
    `business_unit` VARCHAR(80) NULL,
    `designation` VARCHAR(120) NULL,
    `email` VARCHAR(180) NULL,
    `hire_date` DATE NULL,
    `manager_id` VARCHAR(20) NULL,
    `employment_status` VARCHAR(40) NOT NULL DEFAULT 'Active',
    `availability_status` VARCHAR(40) NOT NULL DEFAULT 'Available',

    INDEX `employees_department_id_idx`(`department_id` ASC),
    UNIQUE INDEX `employees_email_key`(`email` ASC),
    INDEX `employees_manager_id_idx`(`manager_id` ASC),
    INDEX `employees_organization_id_idx`(`organization_id` ASC),
    INDEX `employees_role_id_fkey`(`role_id` ASC),
    INDEX `employees_team_id_idx`(`team_id` ASC),
    PRIMARY KEY (`employee_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_balances` (
    `balance_id` VARCHAR(20) NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `leave_type` VARCHAR(50) NOT NULL,
    `entitlement` INTEGER NOT NULL,
    `used_days` INTEGER NOT NULL,
    `pending_days` INTEGER NOT NULL DEFAULT 0,
    `available_days` INTEGER NOT NULL,

    INDEX `leave_balances_employee_id_idx`(`employee_id` ASC),
    PRIMARY KEY (`balance_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `leave_request_id` VARCHAR(20) NOT NULL,
    `request_id` VARCHAR(20) NOT NULL,
    `leave_type` VARCHAR(50) NOT NULL,
    `total_days` DECIMAL(5, 2) NOT NULL,
    `proof_required` BOOLEAN NOT NULL DEFAULT false,
    `handover_employee_id` VARCHAR(20) NULL,

    UNIQUE INDEX `leave_requests_request_id_key`(`request_id` ASC),
    PRIMARY KEY (`leave_request_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` VARCHAR(20) NOT NULL,
    `recipient_employee_id` VARCHAR(20) NOT NULL,
    `request_id` VARCHAR(20) NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'Unread',
    `created_at` DATETIME(3) NOT NULL,

    INDEX `notifications_recipient_employee_id_idx`(`recipient_employee_id` ASC),
    INDEX `notifications_request_id_idx`(`request_id` ASC),
    PRIMARY KEY (`notification_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `organization_id` VARCHAR(20) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',

    PRIMARY KEY (`organization_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `permission_id` VARCHAR(40) NOT NULL,
    `description` VARCHAR(200) NOT NULL,

    PRIMARY KEY (`permission_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_members` (
    `membership_id` VARCHAR(20) NOT NULL,
    `project_id` VARCHAR(20) NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `allocation_pct` DECIMAL(5, 2) NOT NULL,
    `project_role` VARCHAR(100) NULL,

    INDEX `project_members_employee_id_idx`(`employee_id` ASC),
    INDEX `project_members_project_id_idx`(`project_id` ASC),
    PRIMARY KEY (`membership_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `project_id` VARCHAR(20) NOT NULL,
    `project_name` VARCHAR(150) NOT NULL,
    `department_id` VARCHAR(20) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `priority` VARCHAR(30) NOT NULL,

    INDEX `projects_department_id_idx`(`department_id` ASC),
    PRIMARY KEY (`project_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `token_id` VARCHAR(40) NOT NULL,
    `user_id` VARCHAR(40) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_user_id_idx`(`user_id` ASC),
    PRIMARY KEY (`token_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_context` (
    `context_id` BIGINT NOT NULL AUTO_INCREMENT,
    `request_id` VARCHAR(20) NOT NULL,
    `context_key` VARCHAR(100) NOT NULL,
    `context_value` TEXT NULL,
    `source_type` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `request_context_request_id_idx`(`request_id` ASC),
    PRIMARY KEY (`context_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requests` (
    `request_id` VARCHAR(20) NOT NULL,
    `organization_id` VARCHAR(20) NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `request_type` VARCHAR(80) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `priority` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `current_owner_id` VARCHAR(20) NULL,

    INDEX `requests_current_owner_id_idx`(`current_owner_id` ASC),
    INDEX `requests_employee_id_idx`(`employee_id` ASC),
    INDEX `requests_organization_id_fkey`(`organization_id` ASC),
    INDEX `requests_request_type_idx`(`request_type` ASC),
    PRIMARY KEY (`request_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resource_allocations` (
    `allocation_id` VARCHAR(20) NOT NULL,
    `resource_id` VARCHAR(20) NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `project_id` VARCHAR(20) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `allocation_pct` DECIMAL(5, 2) NULL,

    INDEX `resource_allocations_employee_id_idx`(`employee_id` ASC),
    INDEX `resource_allocations_project_id_fkey`(`project_id` ASC),
    INDEX `resource_allocations_resource_id_idx`(`resource_id` ASC),
    PRIMARY KEY (`allocation_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resources` (
    `resource_id` VARCHAR(20) NOT NULL,
    `resource_name` VARCHAR(150) NOT NULL,
    `resource_type` VARCHAR(60) NOT NULL,
    `reference_code` VARCHAR(80) NOT NULL,
    `status` VARCHAR(40) NOT NULL,
    `cost` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'INR',

    PRIMARY KEY (`resource_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` VARCHAR(20) NOT NULL,
    `permission_id` VARCHAR(40) NOT NULL,

    INDEX `role_permissions_permission_id_fkey`(`permission_id` ASC),
    PRIMARY KEY (`role_id` ASC, `permission_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `role_id` VARCHAR(20) NOT NULL,
    `role_name` VARCHAR(100) NOT NULL,
    `role_level` VARCHAR(80) NOT NULL,

    PRIMARY KEY (`role_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skills` (
    `skill_id` VARCHAR(20) NOT NULL,
    `skill_name` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`skill_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teams` (
    `team_id` VARCHAR(20) NOT NULL,
    `department_id` VARCHAR(20) NOT NULL,
    `team_name` VARCHAR(120) NOT NULL,

    INDEX `teams_department_id_idx`(`department_id` ASC),
    PRIMARY KEY (`team_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_accounts` (
    `user_id` VARCHAR(40) NOT NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_accounts_email_key`(`email` ASC),
    UNIQUE INDEX `user_accounts_employee_id_key`(`employee_id` ASC),
    PRIMARY KEY (`user_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_definitions` (
    `workflow_id` VARCHAR(20) NOT NULL,
    `request_type` VARCHAR(80) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `workflow_definitions_request_type_idx`(`request_type` ASC),
    PRIMARY KEY (`workflow_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_steps` (
    `step_id` VARCHAR(20) NOT NULL,
    `workflow_id` VARCHAR(20) NOT NULL,
    `step_order` INTEGER NOT NULL,
    `step_name` VARCHAR(100) NOT NULL,
    `approver_type` VARCHAR(80) NOT NULL,
    `sla_hours` INTEGER NOT NULL,
    `proof_required` VARCHAR(30) NOT NULL DEFAULT 'Optional',

    INDEX `workflow_steps_workflow_id_idx`(`workflow_id` ASC),
    PRIMARY KEY (`step_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_skills` ADD CONSTRAINT `employee_skills_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_skills` ADD CONSTRAINT `employee_skills_skill_id_fkey` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`skill_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`team_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_employee_id_fkey` FOREIGN KEY (`recipient_employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`project_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user_accounts`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_context` ADD CONSTRAINT `request_context_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`request_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_current_owner_id_fkey` FOREIGN KEY (`current_owner_id`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`organization_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resource_allocations` ADD CONSTRAINT `resource_allocations_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resource_allocations` ADD CONSTRAINT `resource_allocations_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`project_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resource_allocations` ADD CONSTRAINT `resource_allocations_resource_id_fkey` FOREIGN KEY (`resource_id`) REFERENCES `resources`(`resource_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`permission_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`department_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_accounts` ADD CONSTRAINT `user_accounts_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_steps` ADD CONSTRAINT `workflow_steps_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions`(`workflow_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

