-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(32) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `roles_codigo_unique`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `nome_completo` VARCHAR(180) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `telefone` VARCHAR(20) NOT NULL,
    `cpf` VARCHAR(11) NOT NULL,
    `senha_hash` TEXT NOT NULL,
    `data_nascimento` DATE NOT NULL,
    `foto` VARCHAR(500) NULL,
    `aceitou_direito_imagem` BOOLEAN NOT NULL DEFAULT false,
    `data_aceite_direito_imagem` DATETIME(3) NULL,
    `qr_code_hash` VARCHAR(255) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_email_unique`(`email`),
    UNIQUE INDEX `usuarios_cpf_unique`(`cpf`),
    UNIQUE INDEX `usuarios_qr_code_hash_unique`(`qr_code_hash`),
    INDEX `usuarios_ativo_idx`(`ativo`),
    INDEX `usuarios_role_id_idx`(`role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkins` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario_id` BIGINT NOT NULL,
    `data_checkin` DATE NOT NULL,
    `horario_checkin` DATETIME(3) NOT NULL,
    `realizado_por_usuario_id` BIGINT NOT NULL,
    `metodo` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `checkins_data_idx`(`data_checkin`),
    INDEX `checkins_realizado_por_fk`(`realizado_por_usuario_id`),
    UNIQUE INDEX `checkins_usuario_data_unique`(`usuario_id`, `data_checkin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditoria` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario_responsavel_id` BIGINT NULL,
    `acao` VARCHAR(120) NOT NULL,
    `entidade` VARCHAR(80) NOT NULL,
    `entidade_id` VARCHAR(64) NULL,
    `dados_anteriores` JSON NULL,
    `dados_novos` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoria_created_at_idx`(`created_at`),
    INDEX `auditoria_responsavel_idx`(`usuario_responsavel_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessoes` (
    `id` VARCHAR(64) NOT NULL,
    `usuario_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(128) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `ip_hash` VARCHAR(128) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessoes_token_hash_unique`(`token_hash`),
    INDEX `sessoes_expires_idx`(`expires_at`),
    INDEX `sessoes_usuario_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limits` (
    `rate_key` VARCHAR(255) NOT NULL,
    `request_count` INTEGER NOT NULL,
    `window_started_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `rate_limits_expiry_idx`(`expires_at`),
    PRIMARY KEY (`rate_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estandes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(40) NOT NULL,
    `nome` VARCHAR(180) NULL,
    `localizacao` VARCHAR(255) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'DISPONIVEL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `estandes_codigo_unique`(`codigo`),
    INDEX `estandes_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professor_escolas` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `professor_usuario_id` BIGINT NOT NULL,
    `nome` VARCHAR(180) NOT NULL,
    `cidade` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `professor_escolas_professor_unique`(`professor_usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professor_temas` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `escola_id` BIGINT NOT NULL,
    `titulo` VARCHAR(180) NOT NULL,
    `area` VARCHAR(180) NULL,
    `descricao` VARCHAR(500) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDENTE',
    `estande_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `professor_temas_estande_unique`(`estande_id`),
    INDEX `professor_temas_escola_idx`(`escola_id`),
    INDEX `professor_temas_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professor_tema_alunos` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tema_id` BIGINT NOT NULL,
    `usuario_id` BIGINT NOT NULL,
    `nome_completo` VARCHAR(180) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `professor_tema_alunos_usuario_unique`(`usuario_id`),
    INDEX `professor_tema_alunos_tema_idx`(`tema_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professor_aluno_documentos` (
    `id` VARCHAR(64) NOT NULL,
    `professor_tema_aluno_id` BIGINT NOT NULL,
    `original_name` VARCHAR(180) NOT NULL,
    `storage_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `sha256` VARCHAR(128) NOT NULL,
    `scan_status` VARCHAR(32) NOT NULL DEFAULT 'clean',
    `encryption_iv` BLOB NOT NULL,
    `encryption_tag` BLOB NOT NULL,
    `encryption_key_version` INTEGER NOT NULL,
    `file_data` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `professor_aluno_documentos_storage_unique`(`storage_name`),
    INDEX `professor_aluno_documentos_aluno_idx`(`professor_tema_aluno_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snct_events` (
    `id` VARCHAR(64) NOT NULL,
    `event_date` TEXT NOT NULL,
    `event_time` TEXT NOT NULL,
    `title` TEXT NOT NULL,
    `location` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snct_notices` (
    `id` VARCHAR(64) NOT NULL,
    `title` TEXT NOT NULL,
    `registration` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snct_notice_documents` (
    `id` VARCHAR(64) NOT NULL,
    `notice_id` VARCHAR(64) NULL,
    `original_name` TEXT NOT NULL,
    `storage_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `sha256` VARCHAR(128) NOT NULL,
    `scan_status` VARCHAR(32) NOT NULL DEFAULT 'clean',
    `encryption_iv` BLOB NOT NULL,
    `encryption_tag` BLOB NOT NULL,
    `encryption_key_version` INTEGER NOT NULL,
    `file_data` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `snct_notice_documents_storage_unique`(`storage_name`),
    INDEX `snct_notice_documents_notice_idx`(`notice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snct_partners` (
    `id` VARCHAR(64) NOT NULL,
    `name` TEXT NOT NULL,
    `logo` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snct_site_settings` (
    `id` SMALLINT NOT NULL DEFAULT 1,
    `event_edition` VARCHAR(255) NOT NULL,
    `hero_image_url` VARCHAR(600) NOT NULL,
    `privacy_version` VARCHAR(64) NOT NULL DEFAULT '2026-07-20',
    `retention_months` INTEGER NOT NULL DEFAULT 24,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snct_migrations` (
    `filename` VARCHAR(255) NOT NULL,
    `checksum` VARCHAR(128) NOT NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`filename`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_role_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_usuario_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_realizado_por_fk` FOREIGN KEY (`realizado_por_usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_responsavel_fk` FOREIGN KEY (`usuario_responsavel_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sessoes` ADD CONSTRAINT `sessoes_usuario_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `professor_escolas` ADD CONSTRAINT `professor_escolas_professor_fk` FOREIGN KEY (`professor_usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `professor_temas` ADD CONSTRAINT `professor_temas_escola_fk` FOREIGN KEY (`escola_id`) REFERENCES `professor_escolas`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `professor_temas` ADD CONSTRAINT `professor_temas_estande_fk` FOREIGN KEY (`estande_id`) REFERENCES `estandes`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `professor_tema_alunos` ADD CONSTRAINT `professor_tema_alunos_tema_fk` FOREIGN KEY (`tema_id`) REFERENCES `professor_temas`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `professor_tema_alunos` ADD CONSTRAINT `professor_tema_alunos_usuario_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `professor_aluno_documentos` ADD CONSTRAINT `professor_aluno_documentos_aluno_fk` FOREIGN KEY (`professor_tema_aluno_id`) REFERENCES `professor_tema_alunos`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `snct_notice_documents` ADD CONSTRAINT `snct_notice_documents_notice_fk` FOREIGN KEY (`notice_id`) REFERENCES `snct_notices`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

