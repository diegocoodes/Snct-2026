# Prisma (fonte da verdade do banco)

O schema vive em [`schema.prisma`](./schema.prisma).

## Comandos

```bash
# Gerar o client
npm run db:generate

# Aplicar migrações em produção/staging
npm run db:migrate

# Criar nova migração em desenvolvimento
npm run db:migrate:dev

# Studio visual
npm run db:studio
```

## Convenções

- Models em PascalCase (`Stand`, `Projeto`, `Usuario`)
- Tabelas físicas em snake_case via `@@map` (ex.: `Stand` → `estandes`)
- Campos em camelCase com `@map` para colunas snake_case

## Legado

As migrações SQL antigas em `db/migrations/` permanecem só como histórico.
Novas alterações de schema devem ser feitas com Prisma Migrate.
