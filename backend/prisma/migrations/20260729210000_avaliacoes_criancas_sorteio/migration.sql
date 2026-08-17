ALTER TABLE `professor_tema_alunos`
  ADD COLUMN `nome_responsavel` VARCHAR(180) NOT NULL DEFAULT 'Não informado' AFTER `nome_completo`;

ALTER TABLE `avaliacoes`
  DROP INDEX `avaliacoes_avaliador_projeto_unique`,
  ADD COLUMN `tentativa` TINYINT NOT NULL DEFAULT 1 AFTER `avaliador_usuario_id`,
  ADD UNIQUE INDEX `avaliacoes_avaliador_projeto_tentativa_unique`
    (`avaliador_usuario_id`, `projeto_id`, `tentativa`);

CREATE TABLE `avaliador_stand_sorteios` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `avaliador_usuario_id` BIGINT NOT NULL,
  `stand_id` BIGINT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `avaliador_stand_sorteios_avaliador_stand_unique`
    (`avaliador_usuario_id`, `stand_id`),
  INDEX `avaliador_stand_sorteios_stand_idx` (`stand_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `avaliador_stand_sorteios_avaliador_fk`
    FOREIGN KEY (`avaliador_usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `avaliador_stand_sorteios_stand_fk`
    FOREIGN KEY (`stand_id`) REFERENCES `estandes` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
