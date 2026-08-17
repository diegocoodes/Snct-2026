-- Permite várias escolas por professor (FK usa o índice único atual)
ALTER TABLE `professor_escolas`
  DROP FOREIGN KEY `professor_escolas_professor_fk`;

ALTER TABLE `professor_escolas`
  DROP INDEX `professor_escolas_professor_unique`;

CREATE INDEX `professor_escolas_professor_idx`
  ON `professor_escolas` (`professor_usuario_id`);

ALTER TABLE `professor_escolas`
  ADD CONSTRAINT `professor_escolas_professor_fk`
  FOREIGN KEY (`professor_usuario_id`) REFERENCES `usuarios` (`id`)
  ON DELETE CASCADE ON UPDATE NO ACTION;
