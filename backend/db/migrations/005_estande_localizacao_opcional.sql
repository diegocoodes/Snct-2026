-- Localização deixa de ser obrigatória no cadastro de estande

ALTER TABLE estandes
  MODIFY COLUMN localizacao VARCHAR(255) NULL;
