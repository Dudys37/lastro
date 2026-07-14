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

## F2 — Contas, Cartões e Lançamentos (implementada)

**Contas** (corrente/poupança/dinheiro/investimento) com saldo inicial; saldo
atual calculado por `saldoDaConta` (pura, testada): receitas somam, despesas
em conta subtraem, **despesa no cartão não toca a conta** (quem paga é a
fatura, F3) e transferências movem sem criar dinheiro (invariante testada:
soma dos saldos constante). **Cartões** com limite, dias de fechamento e
vencimento (1–28) e barra de gasto do mês. **Categorias** por workspace com
seed padrão idempotente (15 categorias pt-BR) na primeira visita de um admin.

**Lançamentos**: navegação por mês (competência = data), resumo
receitas/despesas/saldo (transferências ficam de fora — só movem dinheiro),
formulário com três tipos e **parcelamento**: `dividirParcelas` (soma exata,
resto nas primeiras) × `datasParcelas` (mensal com clamp de fim de mês —
31/jan → 28/fev), gravadas em `writeBatch` com `grupoId` comum, tudo ou nada.
Exclusão individual ou do grupo inteiro de parcelas.

**Papel no contexto**: `WorkspaceProvider` agora expõe `papel` do usuário no
workspace ativo — gates de UI via `podeFazer` (leitor não vê botões de lançar;
editor não vê gestão de contas). As Rules seguem sendo a fronteira real, e as
da F1 já cobriam o núcleo financeiro — **nenhuma mudança de regras nesta fase**.

**Decisão consciente**: `listarTodosLancamentos` para saldos lê o histórico
completo — adequado ao volume pessoal/pequena equipe; snapshot de saldo
incremental é otimização anotada para fase futura.

## F3 — Faturas & Orçamentos (implementada)

**Fatura por ciclo real** (`src/lib/faturas.ts`, pura e testada): a fatura é
identificada pelo mês de FECHAMENTO; compra com dia ≤ diaFechamento entra na
fatura do mês, senão empurra para a seguinte (`mesFatura`). Vencimento no
mesmo mês quando vence depois de fechar, senão no seguinte. `cicloDaFatura`
usa aritmética real de datas (borda 28/fev × bissexto testada). Status:
aberta → fechada → parcial → paga.

**Pagamento de fatura é tipo próprio** (`'pagamento'`): DEBITA a conta
(`saldoDaConta`) mas NÃO conta como despesa (`resumoLancamentos`) — as
despesas já contaram na data de cada compra. Invariante testada: comprar no
cartão e pagar a fatura debita a conta uma única vez e registra a despesa uma
única vez. Página de Faturas: seletor de cartão, navegação por mês de fatura,
itens do ciclo com badge de parcela, pagamentos listados e registro de
pagamento com valor sugerido = restante (pagamento parcial suportado).

**Orçamentos**: doc por mês (`orcamentos/{YYYY-MM}`, mapa
categoriaId→centavos), consumo por competência da compra (cartão INCLUÍDO —
orçamento mede consumo, não caixa), barra com faixas 80%/100%, estouro
destacado, "sem categoria" apontado e cópia do mês anterior. Consultas de
ciclo filtram cartão no cliente para não exigir índice composto.

**Sem mudança de regras**: `lancamentos` (editor+) cobre o tipo 'pagamento' e
`orcamentos` (admin+ escreve, membro lê) já existia desde a F0.

## Roadmap

- **F1** Membros & convites: link com token, aceite transacional, tela de gestão de papéis, proteção do dono.
- **F2** Contas/cartões/categorias (admin+) e lançamentos (editor+) com parcelamento via `dividirParcelas`, recorrência e transferências.
- **F3** Faturas por ciclo (fechamento/vencimento) e orçamentos mensais por categoria com rollover opcional.
- **F4** Dashboard (saldos, fluxo, por categoria) e relatórios exportáveis.
- **F5** Metas com aportes e investimentos com posições manuais.
- **F6** Motor de inteligência: regras puras por domínio, severidade, adiar/dispensar — evolução direta do motor do sistema anterior.
