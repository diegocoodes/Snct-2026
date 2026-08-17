# Contribuindo

## Fluxo

1. Crie um branch a partir de `main`.
2. Faça uma mudança pequena e claramente descrita.
3. Atualize testes e documentação.
4. Execute as verificações locais.
5. Abra um pull request com impacto, risco, teste e rollback.
6. Aguarde revisão antes de integrar.

## Verificações

```bash
cd frontend
npm ci
npm run typecheck
npm run test:run
npm run lint
npm run format:check
npm run build
```

Para mudanças no banco ou backend:

```bash
cd backend
npm ci
npm run db:generate
npm run db:migrate
```

Use apenas dados fictícios e nunca execute teste destrutivo em produção.

## Commits e pull requests

Use `tipo: descrição curta`, com tipos como `feat`, `fix`, `docs`, `refactor`, `test`, `chore` e `security`.

O pull request deve explicar o problema, solução, telas/rotas/perfis afetados, evidência dos testes, variáveis ou migrações novas, riscos de segurança/privacidade e rollback. Autenticação, autorização, criptografia, upload, CPF, QR, auditoria e banco exigem revisão adicional.

## Regras de código

- TypeScript estrito; evite `any` sem justificativa.
- Valide toda entrada externa no servidor.
- Reutilize os guards e constantes de papéis existentes.
- Nunca exponha segredos com prefixo `NEXT_PUBLIC_`.
- Preserve teclado, foco visível, rótulos e redução de movimento.
- Documente variáveis, rotas e etapas operacionais novas.
- Siga integralmente o [SECURITY.md](SECURITY.md).

## Banco de dados

- Prisma/MySQL é a fonte de verdade atual.
- Crie migração nova; não edite migração já aplicada.
- Revise índices, unicidade, cascatas e retenção.
- Nunca inclua dump ou dado real no commit.

Uma mudança está pronta quando o comportamento foi testado, a documentação foi atualizada, o diff não contém segredos e o CI aplicável foi aprovado.
