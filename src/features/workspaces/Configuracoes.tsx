// ═══ LASTRO — Configurações do Workspace (F11) ═══
// Renomear (admin+), transferir posse (dono → membro, transação de 3
// escritas validada pelas Rules via getAfter) e excluir o workspace (dono,
// confirmação digitada, limpeza das subcoleções em lotes — Firestore não
// apaga subcoleções sozinho).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, deleteDoc, doc, getDocs, runTransaction, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Membro } from '../../types/dominio';
import { podeFazer } from '../../types/dominio';
import { podeTransferirPosse } from '../../lib/convites';
import { useAuth } from '../auth/Auth';
import { useWorkspace } from '../workspaces/Workspaces';
import { listarMembros } from '../membros/Membros';
import { Botao, Campo, Cartao as Card } from '../../components/ui/Basicos';

const SUBCOLECOES = ['membros', 'contas', 'cartoes', 'categorias', 'lancamentos', 'orcamentos', 'metas', 'investimentos', 'recorrencias'];

async function renomearWorkspace(ws: string, nome: string): Promise<void> {
  await updateDoc(doc(db, 'workspaces', ws), { nome });
}

/** Transação de posse: criadoPor + papel do novo dono + papel do antigo. */
async function transferirPosse(ws: string, meuUid: string, novoDonoUid: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    tx.update(doc(db, 'workspaces', ws), { criadoPor: novoDonoUid });
    tx.update(doc(db, 'workspaces', ws, 'membros', novoDonoUid), { papel: 'dono' });
    tx.update(doc(db, 'workspaces', ws, 'membros', meuUid), { papel: 'admin' });
  });
}

/** Exclusão com limpeza: subcoleções em lotes de 400, depois o doc-mãe. */
async function excluirWorkspaceCompleto(ws: string, aoProgredir: (msg: string) => void): Promise<void> {
  for (const nome of SUBCOLECOES) {
    const snap = await getDocs(collection(db, 'workspaces', ws, nome));
    aoProgredir(`limpando ${nome} (${snap.size})…`);
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const b = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  }
  aoProgredir('removendo o workspace…');
  await deleteDoc(doc(db, 'workspaces', ws));
}

export function PaginaWorkspace() {
  const { usuario } = useAuth();
  const { ativo, papel, recarregar, trocar } = useWorkspace();
  const nav = useNavigate();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [nome, setNome] = useState('');
  const [novoDono, setNovoDono] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [progresso, setProgresso] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const configuro = podeFazer(papel, 'configurar');
  const souDono = papel === 'dono';

  useEffect(() => {
    setNome(ativo?.nome ?? '');
    (async () => {
      if (!ativo) return;
      try { setMembros(await listarMembros(ativo.id)); } catch { /* leitor: lista vazia */ }
    })();
  }, [ativo]);

  if (!ativo || !usuario) return null;

  async function acao(fn: () => Promise<unknown>, msgOk: string) {
    setOcupado(true); setErro(''); setOk('');
    try { await fn(); await recarregar(); setOk(msgOk); }
    catch { setErro('Ação não permitida ou falha de conexão. As regras da F11 foram publicadas?'); }
    finally { setOcupado(false); }
  }

  const candidatos = membros.filter((m) => m.uid !== usuario.uid);

  return (
    <div className="grid max-w-2xl gap-4">
      <Card className="px-5 py-4">
        <h1 className="text-base font-bold">⚙️ Workspace: {ativo.nome}</h1>
        <p className="mt-0.5 text-xs text-ink2">Seu papel aqui: <strong>{papel}</strong>{souDono && ' 👑'}</p>
      </Card>

      {/* renomear */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold">✏️ Nome do workspace</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="h-10 w-64" disabled={!configuro} />
          {configuro && (
            <Botao className="h-10 px-4 text-sm" disabled={ocupado || !nome.trim() || nome.trim() === ativo.nome}
              onClick={() => void acao(() => renomearWorkspace(ativo.id, nome.trim()), 'Nome atualizado.')}>
              Salvar
            </Botao>
          )}
        </div>
        {!configuro && <p className="mt-2 text-xs text-ink3">Só admin+ renomeia o workspace.</p>}
      </Card>

      {/* transferir posse */}
      {souDono && (
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-bold">👑 Transferir posse</h2>
          <p className="mb-3 text-xs text-ink2">
            O novo dono assume o controle total; você vira <strong>admin</strong>. Tudo acontece numa única transação — o workspace nunca fica sem dono.
          </p>
          {candidatos.length === 0
            ? <p className="text-xs text-ink3">Convide alguém primeiro — não há outro membro para receber a posse.</p>
            : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink2">Novo dono</span>
                  <select className="h-10 rounded-lg border border-line bg-card px-2 text-sm" value={novoDono} onChange={(e) => setNovoDono(e.target.value)}>
                    <option value="">Selecione…</option>
                    {candidatos.map((m) => <option key={m.uid} value={m.uid}>{m.nome || m.email}</option>)}
                  </select>
                </label>
                <Botao className="h-10 px-4 text-sm"
                  disabled={ocupado || !podeTransferirPosse(papel!, novoDono, usuario.uid, candidatos.some((m) => m.uid === novoDono))}
                  onClick={() => {
                    const alvo = candidatos.find((m) => m.uid === novoDono);
                    if (alvo && confirm(`Transferir a posse de "${ativo.nome}" para ${alvo.nome || alvo.email}?\n\nVocê passará a ser admin. Esta ação só pode ser desfeita pelo novo dono.`)) {
                      void acao(() => transferirPosse(ativo.id, usuario.uid, novoDono), 'Posse transferida — você agora é admin.');
                    }
                  }}>
                  Transferir
                </Botao>
              </div>
            )}
        </Card>
      )}

      {/* excluir */}
      {souDono && (
        <Card className="border-neg/30 p-5">
          <h2 className="mb-1 text-sm font-bold text-neg">🗑️ Excluir workspace</h2>
          <p className="mb-3 text-xs text-ink2">
            Apaga <strong>tudo</strong>: lançamentos, contas, cartões, orçamentos, metas, investimentos, recorrências e membros.
            Sem volta. Exporte o CSV em Relatórios antes, se quiser guardar o histórico.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Campo rotulo={`Digite o nome exato (${ativo.nome}) para liberar`} value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)} className="h-10 w-64" placeholder={ativo.nome} />
            <Botao variante="perigo" className="h-10 px-4 text-sm" disabled={ocupado || confirmacao !== ativo.nome}
              onClick={() => {
                if (confirm(`ÚLTIMA CONFIRMAÇÃO: excluir "${ativo.nome}" e todos os dados?`)) {
                  setOcupado(true); setErro('');
                  void excluirWorkspaceCompleto(ativo.id, setProgresso)
                    .then(async () => { localStorage.removeItem('lastro_ws'); await recarregar(); trocar(''); nav('/'); })
                    .catch(() => setErro('Falha na exclusão — tente novamente (a limpeza retoma de onde parou).'))
                    .finally(() => setOcupado(false));
                }
              }}>
              Excluir definitivamente
            </Botao>
          </div>
          {progresso && ocupado && <p className="mt-2 text-xs text-ink3">{progresso}</p>}
        </Card>
      )}

      {ok && <p className="text-xs font-semibold text-pos">{ok}</p>}
      {erro && <p className="text-xs text-neg">{erro}</p>}
    </div>
  );
}
