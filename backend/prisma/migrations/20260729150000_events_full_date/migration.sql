-- Converte datas DD/MM para YYYY-MM-DD (edição SNCT 2026)
UPDATE `snct_events`
SET `event_date` = CONCAT(
  '2026-',
  SUBSTRING(`event_date`, 4, 2),
  '-',
  SUBSTRING(`event_date`, 1, 2)
)
WHERE `event_date` REGEXP '^[0-9]{2}/[0-9]{2}$';

-- Converte DD/MM/YYYY para YYYY-MM-DD
UPDATE `snct_events`
SET `event_date` = CONCAT(
  SUBSTRING(`event_date`, 7, 4),
  '-',
  SUBSTRING(`event_date`, 4, 2),
  '-',
  SUBSTRING(`event_date`, 1, 2)
)
WHERE `event_date` REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}$';
