-- Drop legacy SQL migration tracker (unused by the app; Prisma uses _prisma_migrations)
DROP TABLE IF EXISTS `snct_migrations`;
