# Lastro — Arquitetura

## Decisões de fundação (F0)

| Decisão | Escolha | Porquê |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Tipos fortes p/ domínio financeiro; ecossistema; build rápido |
| Estilo | Tailwind + design tokens (CSS vars) | Dois temas de 1ª classe custam o mesmo; aprendido no sistema anterior |
| Backend | Firebase (Auth + Firestore), plano Spark | Custo zero p/ começar; familiar; migração isolada por repositórios |
| Deploy | GitHub Pages via Actions | Fluxo git-push que o dono do projeto já usa; CI roda testes antes |
| Rotas | HashRouter | Pages não tem rewrites de SPA |
| Testes | Vitest | Unidade do domínio desde a F0 (dinheiro, papéis) |

## Modelo de dados (Firestore)

```
/workspaces/{ws}                nome, criadoPor, criadoEm, moeda, membrosUids[]
/workspaces/{ws}/membros/{uid}  papel, nome, email, entrouEm
/workspaces/{ws}/contas/…       (F2)   /cartoes/… (F2)   /categorias/… (F2)
/workspaces/{ws}/lancamentos/…  (F2)   /orcamentos/… (F3) /metas/… (F5)
/convites/{id}                  workspaceId, papel, expiraEm, usado (F1)
```

`membrosUids` é um espelho para a consulta "meus workspaces"
(`array-contains uid`); a fonte de verdade de papel é a subcoleção `membros`,
e as **Rules** validam os dois na criação.

## Papéis

dono > admin > editor > leitor. Matriz única em `PODE` (`dominio.ts`):
ler (todos) · lancar (editor+) · configurar (admin+) · gerirMembros (admin+) ·
excluirWorkspace (dono). As Firestore Rules implementam a MESMA matriz —
cliente nunca é a fronteira de segurança.

## Dinheiro

`Centavos = number` inteiro. `parseBRL` aceita os formatos brasileiros e
retorna `null` p/ ambíguo (ex.: "12,34,56"); `dividirParcelas` distribui o
resto nas primeiras parcelas e SEMPRE soma o total exato (testado por
propriedade em vários pares).

## Herança consciente do sistema anterior (FinançasPRO)

Aproveitado: tokens de dois temas, motor de inteligência como conceito (F6),
disciplina de fases testadas e documentadas, escape/validação como regra.
Abandonado: estado global único `D`, handlers inline, HTML monolítico,
papéis hardcoded no cliente.

## F1 — Membros & Convites (implementada)

**Fluxo do convite**: admin+ gera link `#/convite/{id}` (token aleatório do
Firestore, não-enumerável) com papel definido (nunca 'dono'), validade de 7
dias e uso único. O aceite é uma **transação do cliente**: cria o doc de
membro (carregando `conviteId`), adiciona o uid ao espelho `membrosUids` e
marca o convite como usado — tudo ou nada.

**Segurança sem Cloud Functions** (plano gratuito): as Rules validam a
transação com `get()` (convite válido/na validade/papel idêntico) e
`existsAfter()` (o update do espelho só passa se o doc de membro existir ao
FIM da transação). As duas regras se travam mutuamente: não dá para entrar no
espelho sem membro válido, nem criar membro sem convite válido.

**Proteções de papel** (espelhadas em `podeAlterarMembro`, testada em
`convites.test.ts`): ninguém gere a si mesmo; ninguém mexe no dono; ninguém
promove a dono; admin não gere outro admin (só o dono); sair do workspace é
ação própria e o dono não sai (posse não fica órfã — transferência de posse é
fluxo futuro deliberado). Diffs de `membrosUids` são exatos (±1, o próprio uid).

**Rota**: `/convite/:id` renderiza ANTES do portão de onboarding — convidado
novo (zero workspaces) alcança o aceite; o hash sobrevive ao login.

## Roadmap

- **F1** Membros & convites: link com token, aceite transacional, tela de gestão de papéis, proteção do dono.
- **F2** Contas/cartões/categorias (admin+) e lançamentos (editor+) com parcelamento via `dividirParcelas`, recorrência e transferências.
- **F3** Faturas por ciclo (fechamento/vencimento) e orçamentos mensais por categoria com rollover opcional.
- **F4** Dashboard (saldos, fluxo, por categoria) e relatórios exportáveis.
- **F5** Metas com aportes e investimentos com posições manuais.
- **F6** Motor de inteligência: regras puras por domínio, severidade, adiar/dispensar — evolução direta do motor do sistema anterior.
