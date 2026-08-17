# Política de segurança

## Como relatar uma vulnerabilidade

Não abra issue pública com detalhes exploráveis, credenciais, dados pessoais ou provas de conceito contra ambiente real. Use **Security > Advisories > Report a vulnerability** no GitHub. Se indisponível, contate o mantenedor por canal privado previamente acordado.

Informe o componente afetado, impacto, pré-condições, reprodução mínima com dados fictícios e uma sugestão de correção, se houver. Não realize negação de serviço, engenharia social, persistência, movimentação lateral, acesso a dados de terceiros ou alteração de dados reais.

## Regras obrigatórias

1. Nunca versionar `.env`, tokens, senhas, cookies, chaves, dumps, backups, uploads ou dados pessoais.
2. Nunca registrar senha, sessão, MFA, QR completo, CPF completo ou conteúdo de documento em logs.
3. Toda autorização ocorre no backend; ocultar elementos no frontend não é controle de acesso.
4. Toda mutação valida sessão, perfil, entrada, origem confiável e limite de requisições.
5. Consultas usam Prisma ou parâmetros vinculados; SQL concatenado com entrada externa é proibido.
6. Uploads limitam tamanho, validam assinatura, recebem nome gerado, passam pelo antivírus e ficam fora da área pública.
7. Dados sensíveis armazenados usam criptografia autenticada e chaves externas ao código.
8. Cookies de produção devem ser `HttpOnly`, `Secure` e usar `SameSite` adequado.
9. Produção usa HTTPS, origens explícitas e `SNCT_TRUST_PROXY` compatível com o proxy real.
10. Respostas externas são genéricas; stack traces ficam apenas em logs protegidos.
11. Dependências novas exigem análise de origem, manutenção, licença e vulnerabilidades.
12. Migração aplicada nunca é editada; toda mudança de esquema recebe nova migração.

## Segredos e dados pessoais

- Use valores independentes para autenticação, rate limiting e criptografia.
- Guarde segredos no cofre do provedor e restrinja leitura pelo menor privilégio.
- Rotacione imediatamente qualquer segredo exposto e invalide sessões afetadas.
- Não copie produção para desenvolvimento sem anonimização irreversível.
- Defina com o controlador regras de coleta, retenção, exportação e exclusão (LGPD).
- Backups também obedecem às regras de acesso, retenção, criptografia e descarte.

Exemplos de geração local:

```bash
openssl rand -base64 48  # segredo geral
openssl rand -base64 32  # chave AES-256 de 32 bytes
```

## Checklist antes de publicar

- [ ] `.env`, uploads, dumps e credenciais continuam ignorados.
- [ ] `npm run typecheck` e `npm run test:run` passam no frontend.
- [ ] O lint não ganhou novos erros.
- [ ] `npm run security:audit` não aponta vulnerabilidade alta conhecida em produção.
- [ ] `npm run security:check-env` passa com a configuração de produção.
- [ ] Migrações foram testadas em banco descartável.
- [ ] Perfis permitidos e negados foram testados.
- [ ] Logs e respostas não vazam informações sensíveis.
- [ ] Upload limpo funciona e EICAR é bloqueado em homologação.
- [ ] Backup e restauração foram testados.

## Requisitos de produção

- TLS/HTTPS, HSTS e headers de segurança.
- MySQL e ClamAV sem exposição direta à internet.
- Usuário do banco com privilégios mínimos.
- WAF ou rate limiting adicional no proxy.
- SMTP com SPF, DKIM e DMARC.
- Backups cifrados, monitorados e testados.
- Alertas para 5xx, 429, falhas de login, antivírus e banco.
- MFA para contas privilegiadas quando o fluxo estiver habilitado.
- Teste de intrusão e revisão antes do evento.

## Resposta a incidentes

1. Conter o acesso e revogar sessões afetadas.
2. Rotacionar credenciais e chaves comprometidas.
3. Preservar logs e evidências.
4. Identificar causa, período, sistemas e titulares afetados.
5. Corrigir, testar e monitorar.
6. Avaliar comunicações legais aplicáveis.
7. Registrar lições aprendidas e novos controles.

Nenhum software é seguro apenas por possuir estes controles. A segurança depende também da infraestrutura, configuração, operação e revisão contínua.
