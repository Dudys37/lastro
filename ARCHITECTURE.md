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

## F4 — Dashboard & Relatórios (implementada)

**Gráficos SVG à mão, zero dependências** (`features/relatorios/Graficos.tsx`):
barras duplas de fluxo (receitas × despesas), linha/área da evolução do saldo
consolidado (com linha de zero quando há negativo) e donut de categorias com
legenda. Cores 100% via tokens — os dois temas funcionam de graça; tooltips
nativos via `<title>`; `role="img"` + `aria-label` para acessibilidade.

**Séries em lógica pura testada** (`lib/relatorios.ts`): `ultimosMeses`,
`serieFluxoMensal` (competência; transferências/pagamentos fora),
`serieSaldoConsolidado` (saldo ao fim de cada mês, histórico acumulado) e
`topCategorias`. Página de Relatórios com período 3/6/12 meses e donut do mês
corrente (top 6 + agregado das menores).

**Exportação CSV pt-BR** (`gerarCSV`, testada): separador `;`, decimal com
vírgula, BOM p/ Excel, escape correto de aspas/;/quebras, coluna de parcela
`n/total`. Download client-side por Blob.

**Dashboard**: a Visão Geral ganhou o gráfico de fluxo dos últimos 6 meses ao
lado dos cards de saldo consolidado e fatura em aberto.

## F5 — Metas & Investimentos (implementada)

**Metas** (`lib/metas.ts`, pura e testada): valor alvo, prazo opcional
('YYYY-MM') e aportes como array no doc (adequado à escala; `arrayUnion`/
`arrayRemove`). `progressoMeta` (total/pct/faltam/concluída) e `ritmoMensal` —
quanto aportar POR MÊS até o prazo (teto de faltam/meses, contando o mês
corrente), com estados sem_prazo/concluída/atrasada. UI: cards com barra,
chip de concluída/prazo vencido, aportes inline com histórico e o ritmo
sugerido em destaque. Metas são de editor+ (a regra da F0 já previa).
Decisão: aporte é compromisso de meta, separado do caixa — a dica na UI
orienta registrar também o movimento em Lançamentos quando houver.

**Investimentos**: NOVA subcoleção `investimentos` (regra adicionada:
leitura de membro, escrita editor+ — **exige republicar as Rules**). Posições
manuais (nome, classe, valor atual com carimbo de atualização, nota), total
investido e distribuição por classe reutilizando o Donut da F4. Escopo v1 é
manual por decisão de descoberta; integrações (B3/Open Finance) ficam para o
futuro.

## F6 — Motor de Inteligência (implementada)

**Motor puro** (`lib/inteligencia.ts`): regras recebem um `CtxInteligencia`
pronto e devolvem `Alerta[]` (uid estável, severidade info/atenção/crítico,
título, mensagem, rota de navegação) — sem Firestore, sem UI, 48 testes no
total garantindo cada regra. Famílias implementadas:
fatura vencida/vence em ≤5 dias (fechada e não paga, pagamento parcial
considerado) · fatura corrente fecha em ≤3 dias · cartão ≥90% do limite ·
orçamento ≥80%/estourado · conta negativa · meta com prazo vencido · meta sem
aportes há 60+ dias · gastos sem categoria no mês. Ordenação por severidade.

**Central de Inteligência** (Visão Geral): monta o contexto (orçamento do
mês, categorias, metas), clique navega para a página do problema, 💤 adia 7
dias e ✕ dispensa — persistidos POR usuário+workspace no localStorage
(decisão: ocultar alerta é preferência pessoal, não estado compartilhado do
workspace), com "restaurar ocultos". Top 6 por prioridade, resto agregado.

## F7 — Edição de lançamentos & Recorrências (implementada)

**Edição inline**: receitas e despesas editam descrição/valor/data/categoria
na própria linha (✎); editar uma parcela altera SÓ ela (avisado na UI);
transferências e pagamentos de fatura são excluir-e-refazer por design (mexer
em duas pontas exigiria fluxo próprio).

**Recorrências** (contas fixas — NOVA subcoleção `recorrencias`, regra
editor+ adicionada: **exige republicar as Rules**): tipo, descrição, valor,
dia do mês (1–28, sem ambiguidade de fim de mês), categoria e conta/cartão;
pausar/reativar/excluir. **Materialização é manual de um clique** — decisão
alinhada ao "lançamento manual, simples e confiável" da descoberta: nada
entra nos números sem confirmação humana, sem corrida entre dispositivos e
sem escrita implícita. O painel na página de Lançamentos mostra
pendentes/lançadas do mês ("Lançar" individual ou "Lançar todas"); o vínculo
é por `recorrenciaId` no lançamento (badge 🔁), nunca por descrição.
Nova regra de inteligência: `rec.pendentes` cobra a partir do dia 8.

## F8 — Mobile & PWA (implementada)

**Defeito real corrigido**: a sidebar era `hidden md:flex` SEM alternativa —
no celular o app não tinha navegação nenhuma (um convidado abrindo o link do
convite no telefone ficava preso na primeira tela). Agora: topbar fixa mobile
com ☰, sidebar vira gaveta (overlay + backdrop, fecha ao navegar/tocar fora),
desktop intocado.

**PWA**: `manifest.webmanifest` (pt-BR, standalone, theme #0D9488), ícones
gerados programaticamente (âncora branca em tile teal — 192/512/maskável/
apple-touch) e `favicon.svg` (mata o 404 do console). Service worker
deliberadamente simples: network-first com fallback ao cache, escopo só na
origem (Firestore passa direto) — existe para instalabilidade e oscilações de
rede, **nunca** para servir dado financeiro velho; registrado só em produção.

## F9 — Busca & Filtros de lançamentos (implementada)

**Lógica pura** (`lib/filtros.ts`, testada): `normalizarTexto` (NFD sem
diacríticos — 'Café' ≡ 'cafe'), filtros combináveis em E lógico (busca na
descrição, tipo, categoria com '_sem' para não categorizados, conta/cartão —
conta casa origem E destino de transferências), ordenação por data desc.

**UX**: barra de filtros na página de Lançamentos. Sem filtro, tudo como
antes (mês a mês). Com QUALQUER filtro ativo, a página entra em modo busca:
carrega o histórico completo uma vez (cache invalidado após cada ação),
cabeçalho vira "🔎 Busca no histórico completo · N resultado(s)", o resumo
passa a somar OS RESULTADOS (responde "quanto gastei de Uber no total?"),
formulário e recorrências se recolhem, exibição limitada aos 150 mais
recentes com aviso. Editar/excluir funcionam nos resultados.

## F10 — Importação OFX (implementada)

**Parser puro e hostil-tolerante** (`lib/ofx.ts`, 6 grupos de teste): OFX 1.x
é SGML sem fechamento de tag — o parser trabalha por blocos `<STMTTRN>` via
regex, nunca assume XML válido. `valorOFXParaCentavos` cobre o pântano dos
decimais ('-1.234,56', '1,234.56', '1.234' como milhar, '1234,5') sem passar
por float; `dataOFXParaISO` recorta e valida os 8 dígitos (fusos ao final são
ignorados); `decodificarOFX` tenta UTF-8 e cai para windows-1252 quando vê
excesso de U+FFFD (bancos BR adoram latin-1). Detecção de origem
(banco × fatura de cartão) pelos envelopes OFX.

**Dedup por FITID**: cada lançamento importado grava
`importId = '{conta|cartao}:{id}:{FITID}'`; o preview marca duplicadas como
"já importada" (travadas) — reimportar o mesmo arquivo é seguro por design.
Campo novo `importId` no Lancamento (null nos demais fluxos).

**Fluxo** (`/importar`, editor+): arquivo lido NO navegador → destino
conta/cartão (palpite pelo tipo do arquivo) → toggle "inverter sinais"
(bancos divergem na convenção) → preview com seleção e saldo do lote →
gravação em batches de 400 (limite do Firestore é 500). Importados chegam
sem categoria de propósito — a busca '📦 Sem categoria' (F9) é a esteira de
classificação. Sem mudança de regras.

## F11 — Administração & Ciclo de vida (implementada)

**Endurecimento de segurança** (achado em revisão — **exige republicar as
Rules**): a regra de update do workspace permitia a um ADMIN alterar
`criadoPor` e "roubar" a posse. Agora: admin edita config (`_posseIntacta`),
e a posse só muda pela **transferência transacional do dono** — três
escritas amarradas por `getAfter` (workspace.criadoPor + novo dono vira
'dono' + antigo vira 'admin'); o workspace nunca fica sem dono e o alvo
precisa ser membro atual. Lógica de UI em `podeTransferirPosse` (testada).

**Página ⚙️ Workspace**: renomear (admin+), transferir posse (dono, com
confirmação) e excluir workspace (dono, confirmação DIGITANDO o nome).
Exclusão limpa as 9 subcoleções em lotes de 400 antes do doc-mãe — Firestore
não apaga subcoleções sozinho; a limpeza é retomável se falhar no meio.

**Arquivamento de contas/cartões** (campos existiam desde a F2, agora com
UI): Arquivar/Reativar em Contas & Cartões com seção recolhida 🗄️;
arquivadas somem dos formulários de lançamento/recorrência/pagamento/
importação, mas PERMANECEM na barra de busca (histórico é legítimo) e o
consolidado passa a somar só ativas (`saldoConsolidado`, testada).

## Roadmap

- **F1** Membros & convites: link com token, aceite transacional, tela de gestão de papéis, proteção do dono.
- **F2** Contas/cartões/categorias (admin+) e lançamentos (editor+) com parcelamento via `dividirParcelas`, recorrência e transferências.
- **F3** Faturas por ciclo (fechamento/vencimento) e orçamentos mensais por categoria com rollover opcional.
- **F4** Dashboard (saldos, fluxo, por categoria) e relatórios exportáveis.
- **F5** Metas com aportes e investimentos com posições manuais.
- **F6** Motor de inteligência: regras puras por domínio, severidade, adiar/dispensar — evolução direta do motor do sistema anterior.
