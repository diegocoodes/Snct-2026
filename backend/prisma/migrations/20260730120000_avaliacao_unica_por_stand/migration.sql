-- Uma avaliação por avaliador + stand.
-- Mantém apenas a avaliação mais recente em caso de duplicatas legadas.
DELETE a1 FROM `avaliacoes` a1
INNER JOIN `avaliacoes` a2
  ON a1.`avaliador_usuario_id` = a2.`avaliador_usuario_id`
 AND a1.`stand_id` = a2.`stand_id`
 AND a1.`id` < a2.`id`;

ALTER TABLE `avaliacoes`
  DROP INDEX `avaliacoes_avaliador_projeto_tentativa_unique`,
  ADD UNIQUE INDEX `avaliacoes_avaliador_stand_unique`
    (`avaliador_usuario_id`, `stand_id`);
