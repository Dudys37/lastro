// ═══ LASTRO — Domínio (F0) ═══
// Regra de ouro nº 1: DINHEIRO É INTEIRO EM CENTAVOS. Nunca float.
// Regra de ouro nº 2: todo dado pertence a um workspace; acesso via papel.

/** Valor monetário em centavos (ex.: R$ 1.234,56 → 123456) */
export type Centavos = number;

export type Papel = 'dono' | 'admin' | 'editor' | 'leitor';

/** O que cada papel pode fazer — fonte única de verdade de permissões
 *  no cliente (as Firestore Rules reforçam o mesmo modelo no servidor). */
export const PODE = {
  ler:            ['dono', 'admin', 'editor', 'leitor'],
  lancar:         ['dono', 'admin', 'editor'],
  configurar:     ['dono', 'admin'],           // contas, cartões, categorias, orçamentos
  gerirMembros:   ['dono', 'admin'],
  excluirWorkspace: ['dono'],
} as const satisfies Record<string, readonly Papel[]>;

export type Acao = keyof typeof PODE;

export function podeFazer(papel: Papel | null | undefined, acao: Acao): boolean {
  if (!papel) return false;
  return (PODE[acao] as readonly Papel[]).includes(papel);
}

export interface Workspace {
  id: string;
  nome: string;
  criadoPor: string;      // uid
  criadoEm: number;       // epoch ms
  moeda: 'BRL';
}

export interface Membro {
  uid: string;
  papel: Papel;
  nome: string;
  email: string;
  entrouEm: number;
}

export interface Convite {
  id: string;
  workspaceId: string;
  papel: Exclude<Papel, 'dono'>;
  criadoPor: string;
  criadoEm: number;
  expiraEm: number;       // convites expiram (7 dias)
  usado: boolean;
}

// ── Núcleo financeiro (contratos da F2+, definidos já para orientar o schema) ──
export type TipoLancamento = 'receita' | 'despesa' | 'transferencia' | 'pagamento';
// 'pagamento' = pagamento de fatura de cartão: DEBITA a conta mas NÃO é
// despesa nova — as despesas já foram contadas na data de cada compra.

export interface Conta {
  id: string;
  nome: string;
  tipo: 'corrente' | 'poupanca' | 'dinheiro' | 'investimento';
  saldoInicial: Centavos;
  arquivada: boolean;
}

export interface Cartao {
  id: string;
  nome: string;
  bandeira: string;
  limite: Centavos;
  diaFechamento: number;  // 1–28
  diaVencimento: number;  // 1–28
  arquivado: boolean;
}

export interface Recorrencia {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: Centavos;
  diaDoMes: number;                // 1–28 (sem ambiguidade de fim de mês)
  categoriaId: string | null;
  contaId: string | null;          // OU cartaoId (despesa no cartão)
  cartaoId: string | null;
  ativo: boolean;
  criadoPor: string;
}

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: Centavos;                 // sempre positivo; o tipo dá o sinal
  data: string;                    // 'YYYY-MM-DD'
  categoriaId: string | null;
  contaId: string | null;          // origem (despesa/transferência) ou destino (receita)
  contaDestinoId: string | null;   // só transferência
  cartaoId: string | null;         // despesa no cartão → entra na fatura
  parcelas: { total: number; numero: number; grupoId: string } | null;
  faturaMes: string | null;        // 'YYYY-MM' da fatura paga (só tipo 'pagamento')
  recorrenciaId: string | null;    // origem, quando lançado a partir de uma recorrência (F7)
  importId: string | null;         // '{origem}:{FITID}' quando veio de OFX (F10) — chave de dedup
  criadoPor: string;
  criadoEm: number;
}
