-- Cidade e estado obrigatórios no cadastro de usuários.
ALTER TABLE `usuarios`
  ADD COLUMN `estado` CHAR(2) NOT NULL DEFAULT 'PE' AFTER `data_nascimento`,
  ADD COLUMN `cidade` VARCHAR(120) NOT NULL DEFAULT 'Não informado' AFTER `estado`;
