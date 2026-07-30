-- Titulações diárias concedidas por avaliadores a alunos.
CREATE TABLE `avaliador_titulacoes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `avaliador_usuario_id` BIGINT NOT NULL,
  `aluno_id` BIGINT NOT NULL,
  `aluno_usuario_id` BIGINT NOT NULL,
  `projeto_id` BIGINT NOT NULL,
  `stand_id` BIGINT NOT NULL,
  `categoria` VARCHAR(32) NOT NULL,
  `data_evento` DATE NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `avaliador_titulacoes_avaliador_cat_dia_unique`
    (`avaliador_usuario_id`, `categoria`, `data_evento`),
  INDEX `avaliador_titulacoes_aluno_idx` (`aluno_id`),
  INDEX `avaliador_titulacoes_dia_idx` (`data_evento`),
  INDEX `avaliador_titulacoes_stand_idx` (`stand_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `avaliador_titulacoes_avaliador_fk`
    FOREIGN KEY (`avaliador_usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `avaliador_titulacoes_aluno_fk`
    FOREIGN KEY (`aluno_id`) REFERENCES `professor_tema_alunos` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `avaliador_titulacoes_aluno_usuario_fk`
    FOREIGN KEY (`aluno_usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `avaliador_titulacoes_projeto_fk`
    FOREIGN KEY (`projeto_id`) REFERENCES `professor_temas` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `avaliador_titulacoes_stand_fk`
    FOREIGN KEY (`stand_id`) REFERENCES `estandes` (`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
