-- Estandes do evento e vínculo exclusivo ao projeto (professor_temas)
-- Status do projeto: PENDENTE | APROVADO | REJEITADO
-- Status do estande: DISPONIVEL | OCUPADO | INATIVO

CREATE TABLE estandes (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL,
  nome VARCHAR(180) NULL,
  localizacao VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DISPONIVEL',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY estandes_codigo_unique (codigo),
  KEY estandes_status_idx (status),
  CONSTRAINT estandes_status_check CHECK (
    status IN ('DISPONIVEL', 'OCUPADO', 'INATIVO')
  )
);

ALTER TABLE professor_temas
  ADD COLUMN area VARCHAR(180) NULL AFTER titulo,
  ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'PENDENTE' AFTER descricao,
  ADD COLUMN estande_id BIGINT NULL AFTER status,
  ADD UNIQUE KEY professor_temas_estande_unique (estande_id),
  ADD KEY professor_temas_status_idx (status),
  ADD CONSTRAINT professor_temas_status_check CHECK (
    status IN ('PENDENTE', 'APROVADO', 'REJEITADO')
  ),
  ADD CONSTRAINT professor_temas_estande_fk
    FOREIGN KEY (estande_id) REFERENCES estandes(id) ON DELETE SET NULL;
