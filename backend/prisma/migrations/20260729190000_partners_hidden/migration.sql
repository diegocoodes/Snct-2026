-- Permite ocultar parceiros do site público sem excluir
ALTER TABLE `snct_partners`
  ADD COLUMN `hidden` TINYINT(1) NOT NULL DEFAULT 0 AFTER `logo`;
