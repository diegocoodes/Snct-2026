-- Reservas exclusivas de stand para avaliadores (25 minutos).
-- Reutiliza a tabela de sorteios: 1 reserva ativa por stand.
DELETE FROM `avaliador_stand_sorteios`;

ALTER TABLE `avaliador_stand_sorteios`
  ADD COLUMN `expires_at` DATETIME(3) NOT NULL AFTER `stand_id`,
  DROP INDEX `avaliador_stand_sorteios_avaliador_stand_unique`,
  ADD UNIQUE INDEX `avaliador_stand_sorteios_stand_unique` (`stand_id`),
  ADD INDEX `avaliador_stand_sorteios_avaliador_idx` (`avaliador_usuario_id`),
  ADD INDEX `avaliador_stand_sorteios_expires_idx` (`expires_at`);
