-- QR hash nos stands + ficha de avaliação

ALTER TABLE `estandes`
  ADD COLUMN `qr_code_hash` VARCHAR(255) NULL;

UPDATE `estandes`
SET `qr_code_hash` = CONCAT(
  'st_',
  LOWER(HEX(RANDOM_BYTES(24)))
)
WHERE `qr_code_hash` IS NULL;

ALTER TABLE `estandes`
  MODIFY COLUMN `qr_code_hash` VARCHAR(255) NOT NULL,
  ADD UNIQUE INDEX `estandes_qr_code_hash_unique` (`qr_code_hash`);

CREATE TABLE `avaliacoes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `stand_id` BIGINT NOT NULL,
  `projeto_id` BIGINT NOT NULL,
  `avaliador_usuario_id` BIGINT NOT NULL,
  `c11_organizacao` INT NULL,
  `c12_estruturacao` INT NULL,
  `c13_relevancia_tema` INT NULL,
  `c14_impacto_projeto` INT NULL,
  `c21_comunicacao` INT NULL,
  `c22_resposta_perguntas` INT NULL,
  `c31_fundamentacao` INT NULL,
  `c32_metodo` INT NULL,
  `c35_originalidade` INT NULL,
  `c34_conclusao` INT NULL,
  `total` INT NOT NULL DEFAULT 0,
  `observacoes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `avaliacoes_avaliador_projeto_unique` (`avaliador_usuario_id`, `projeto_id`),
  KEY `avaliacoes_stand_idx` (`stand_id`),
  KEY `avaliacoes_projeto_idx` (`projeto_id`),
  CONSTRAINT `avaliacoes_stand_fk`
    FOREIGN KEY (`stand_id`) REFERENCES `estandes`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `avaliacoes_projeto_fk`
    FOREIGN KEY (`projeto_id`) REFERENCES `professor_temas`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `avaliacoes_avaliador_fk`
    FOREIGN KEY (`avaliador_usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT
);
