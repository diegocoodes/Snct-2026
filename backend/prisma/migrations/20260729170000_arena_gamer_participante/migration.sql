-- Role Participante (Arena Gamer) + tabelas de times

INSERT INTO `roles` (`codigo`, `nome`)
SELECT 'PARTICIPANTE', 'Participante'
WHERE NOT EXISTS (
  SELECT 1 FROM `roles` WHERE `codigo` = 'PARTICIPANTE'
);

CREATE TABLE IF NOT EXISTS `arena_times` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(120) NOT NULL,
  `jogo` VARCHAR(32) NOT NULL,
  `responsavel_usuario_id` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `arena_times_jogo_idx` (`jogo`),
  INDEX `arena_times_responsavel_idx` (`responsavel_usuario_id`),
  CONSTRAINT `arena_times_responsavel_fk`
    FOREIGN KEY (`responsavel_usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE RESTRICT ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `arena_time_membros` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `time_id` BIGINT NOT NULL,
  `usuario_id` BIGINT NOT NULL,
  `nick` VARCHAR(80) NOT NULL,
  `ordem` TINYINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `arena_time_membros_time_ordem_unique` (`time_id`, `ordem`),
  UNIQUE INDEX `arena_time_membros_time_usuario_unique` (`time_id`, `usuario_id`),
  INDEX `arena_time_membros_usuario_idx` (`usuario_id`),
  CONSTRAINT `arena_time_membros_time_fk`
    FOREIGN KEY (`time_id`) REFERENCES `arena_times` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `arena_time_membros_usuario_fk`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
