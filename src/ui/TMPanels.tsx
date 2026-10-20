import { useMemo } from 'react';
import { deleteEdges } from '../core/fa/edit';
import { BLANK, MOVE_LABEL, tapeAlphabet, tmTransitionLabel, type TM, type TMMove, type TMTransition } from '../core/tm/model';
import { addTMTransition, setHaltRole, removeTMSymbol, removeTMTransition, renameTMSymbol, suggestTMTransition, tmUsesOf, updateTMTransition } from '../core/tm/edit';
import { validateTM } from '../core/tm/validate';
import { useApp } from '../state/store';
import { HelpTip } from './HelpTip';
import { Icon } from './icons';
import { SymbolSetEditor } from './PDAPanels';

const useTM = () => useApp((s) => s.project.machine) as TM;

/** Restrições extras para símbolos de MT. */
function tmSymbolCheck(m: TM, where: 'input' | 'tape') {
  return (s: string): string | null => {
    if (s === BLANK) return where === 'input' ? 'O branco ⊔ não pode pertencer a Σ (Def. 3.3).' : 'O branco ⊔ já pertence a Γ.';
    if (s.includes('→')) return 'Símbolos não podem conter "→" (usado nos rótulos).';
    if (where === 'tape' && m.inputAlphabet.includes(s)) return `"${s}" já está em Σ (e portanto em Γ).`;
    if (where === 'input' && m.tapeSymbols.includes(s)) return `"${s}" já é símbolo extra da fita; remova-o de lá antes de pô-lo em Σ.`;
    return null;
  };
}

// ---------------------------------------------------------------- máquina
export function TMMachineProps() {
  const m = useTM();
  const project = useApp((s) => s.project);
  const st = useApp.getState();
  const nm = (id: string | null) => m.states.find((s) => s.id === id)?.name;
  return (
    <section className="card">
      <h3>Máquina</h3>
      <label className="field">
        <span>Nome do projeto</span>
        <input value={project.name} onChange={(e) => st.setProjectMeta({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>Descrição</span>
        <textarea rows={2} value={project.description} onChange={(e) => st.setProjectMeta({ description: e.target.value })} />
      </label>
      <p className="muted small">
        <strong>Máquina de Turing</strong> determinística de uma fita (Def. 3.3): δ: Q × Γ → Q × Γ × {'{E, D}'}. Cada transição lê um símbolo da fita, escreve um símbolo e move o cabeçote uma célula para a esquerda (E) ou para a direita (D). <HelpTip topic="tmTape" />
      </p>
      <SymbolSetEditor
        id="alpha-tm-sigma"
        label="Σ"
        symbols={m.inputAlphabet}
        check={tmSymbolCheck(m, 'input')}
        uses={(a) => tmUsesOf(m, a)}
        onAdd={(syms) => st.applyTM((mm) => ({ ...mm, inputAlphabet: [...mm.inputAlphabet, ...syms] }))}
        onRemove={(a) => st.applyTM((mm) => removeTMSymbol(mm, a))}
        onRename={(a, b) => st.applyTM((mm) => renameTMSymbol(mm, a, b))}
        help="Alfabeto de entrada. Não pode conter o branco ⊔."
      />
      <SymbolSetEditor
        id="alpha-tm-extra"
        label="Extras da fita"
        symbols={m.tapeSymbols}
        check={tmSymbolCheck(m, 'tape')}
        uses={(a) => tmUsesOf(m, a)}
        onAdd={(syms) => st.applyTM((mm) => ({ ...mm, tapeSymbols: [...mm.tapeSymbols, ...syms] }))}
        onRemove={(a) => st.applyTM((mm) => removeTMSymbol(mm, a))}
        onRename={(a, b) => st.applyTM((mm) => renameTMSymbol(mm, a, b))}
        help="Símbolos que a máquina pode escrever além dos de Σ (ex.: marcas como x)."
      />
      <p className="field">
        <span>Γ (alfabeto da fita)</span>
        <span className="mono">{`{${tapeAlphabet(m).join(', ')}}`}</span>
        <small className="muted">Γ = Σ ∪ extras ∪ {'{⊔}'}, calculado automaticamente; assim Σ ⊆ Γ e ⊔ ∈ Γ sempre valem.</small>
      </p>
      <div className="field">
        <span>
          Estados de parada <HelpTip topic="tmHalt" />
        </span>
        <label className="inline-field">
          <span>q_aceita</span>
          <select value={m.acceptState ?? ''} onChange={(e) => st.applyTM((mm) => ({ ...mm, acceptState: e.target.value || null, rejectState: mm.rejectState === e.target.value ? null : mm.rejectState }))}>
            <option value="">(escolha um estado)</option>
            {m.states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>q_rejeita</span>
          <select value={m.rejectState ?? ''} onChange={(e) => st.applyTM((mm) => ({ ...mm, rejectState: e.target.value || null, acceptState: mm.acceptState === e.target.value ? null : mm.acceptState }))}>
            <option value="">implícito (não desenhado)</option>
            {m.states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <small className="muted">
          {m.rejectState ? `Rejeita ao entrar em ${nm(m.rejectState)} ou quando falta transição.` : 'Sem estado de rejeição desenhado: falta de transição leva a q_rejeita (p. 152).'}
        </small>
      </div>
      <p className="muted small">
        {m.states.length} estado(s), {m.edges.reduce((a, e) => a + e.transitions.length, 0)} transição(ões) em {m.edges.length} seta(s).
      </p>
    </section>
  );
}

/** Papel do estado: comum, aceitação ou rejeição (para o painel do estado). */
export function TMStateRole({ id }: { id: string }) {
  const m = useTM();
  const st = useApp.getState();
  const role = m.acceptState === id ? 'accept' : m.rejectState === id ? 'reject' : 'none';
  const set = (r: 'accept' | 'reject' | 'none') => st.applyTM((mm) => setHaltRole(mm, id, r));
  return (
    <div className="field">
      <span>
        Papel <HelpTip topic="tmHalt" />
      </span>
      <div className="segmented" role="radiogroup" aria-label="Papel do estado">
        <button role="radio" aria-checked={role === 'none'} onClick={() => set('none')}>
          Comum
        </button>
        <button role="radio" aria-checked={role === 'accept'} onClick={() => set('accept')}>
          q_aceita
        </button>
        <button role="radio" aria-checked={role === 'reject'} onClick={() => set('reject')}>
          q_rejeita
        </button>
      </div>
      <small className="muted">Há um único q_aceita e no máximo um q_rejeita desenhado; escolher aqui substitui o anterior. Estados de parada não têm transições de saída.</small>
    </div>
  );
}

// ---------------------------------------------------------------- seta (várias transições)
export function TMEdgeProps({ id }: { id: string }) {
  const m = useTM();
  const st = useApp.getState();
  const e = m.edges.find((x) => x.id === id)!;
  const gamma = tapeAlphabet(m);
  const nm = (sid: string) => m.states.find((s) => s.id === sid)?.name ?? '?';
  const upd = (tid: string, patch: Partial<Omit<TMTransition, 'id'>>) => st.applyTM((mm) => updateTMTransition(mm, id, tid, patch));
  const opt = (v: string) => (gamma.includes(v) ? gamma : [...gamma, v]);
  // leituras usadas por OUTRAS transições do mesmo estado de origem (conflito de determinismo)
  const conflicts = (t: TMTransition) => m.edges.some((x) => x.from === e.from && x.transitions.some((y) => y.id !== t.id && y.read === t.read));
  return (
    <section className="card">
      <h3>Transições</h3>
      <p className="edge-title">
        <button className="link" onClick={() => st.select({ states: [e.from] })}>
          {nm(e.from)}
        </button>{' '}
        →{' '}
        <button className="link" onClick={() => st.select({ states: [e.to] })}>
          {nm(e.to)}
        </button>
        {e.from === e.to && <span className="tag">laço</span>}
      </p>
      <p className="muted small">
        Cada linha é uma transição "a → b, D": lê <em>a</em>, escreve <em>b</em> e move para E (esquerda) ou D (direita). Se escrever o mesmo símbolo que leu, o rótulo é abreviado "a → D", como no livro.
      </p>
      <div className="pda-trans tm-trans">
        <div className="pda-trans-head" aria-hidden="true">
          <span>Lê</span>
          <span>Escreve</span>
          <span>Move</span>
          <span />
        </div>
        {e.transitions.map((t) => (
          <div key={t.id} className={`pda-trans-row${conflicts(t) ? ' conflict' : ''}`} role="group" aria-label={`Transição ${tmTransitionLabel(t)}`}>
            <select aria-label="Lê" value={t.read} onChange={(ev) => upd(t.id, { read: ev.target.value, ...(t.write === t.read ? { write: ev.target.value } : {}) })}>
              {opt(t.read).map((a) => (
                <option key={a} value={a}>
                  {a}
                  {!gamma.includes(a) ? ' (fora de Γ)' : ''}
                </option>
              ))}
            </select>
            <select aria-label="Escreve" value={t.write} onChange={(ev) => upd(t.id, { write: ev.target.value })}>
              {opt(t.write).map((a) => (
                <option key={a} value={a}>
                  {a}
                  {a === t.read ? ' (=)' : ''}
                  {!gamma.includes(a) ? ' (fora de Γ)' : ''}
                </option>
              ))}
            </select>
            <div className="segmented compact" role="radiogroup" aria-label="Move">
              {(['L', 'R'] as TMMove[]).map((mv) => (
                <button key={mv} role="radio" aria-checked={t.move === mv} title={mv === 'L' ? 'Esquerda' : 'Direita'} onClick={() => upd(t.id, { move: mv })}>
                  {MOVE_LABEL[mv]}
                </button>
              ))}
            </div>
            <button className="btn small ghost" aria-label={`Excluir transição ${tmTransitionLabel(t)}`} title="Excluir transição" onClick={() => st.applyTM((mm) => removeTMTransition(mm, id, t.id))}>
              <Icon name="x" />
            </button>
            {conflicts(t) && (
              <small className="error-text row-note">
                ✗ {nm(e.from)} já tem outra transição lendo "{t.read}": a MT é determinística (δ é função).
              </small>
            )}
          </div>
        ))}
        {e.transitions.length === 0 && <p className="muted small">Nenhuma transição nesta seta.</p>}
      </div>
      {(e.from === m.acceptState || e.from === m.rejectState) && <p className="callout error">{nm(e.from)} é um estado de parada: transições saindo dele nunca são usadas e são um erro de validação.</p>}
      <div className="row wrap">
        <button className="btn small" onClick={() => st.applyTM((mm) => addTMTransition(mm, id, suggestTMTransition(mm, e.from)).machine)}>
          <Icon name="plus" /> Adicionar transição
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            st.apply((mm) => deleteEdges(mm, new Set([id])));
            st.clearSelection();
          }}
        >
          <Icon name="trash" /> Excluir seta
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- tabela e definição formal
export function TMTable() {
  const m = useTM();
  const select = useApp((s) => s.select);
  const gamma = tapeAlphabet(m);
  const cell = useMemo(() => {
    const map = new Map<string, { text: string; edgeId: string; n: number }>();
    const nm = (id: string) => m.states.find((s) => s.id === id)?.name ?? '?';
    for (const e of m.edges)
      for (const t of e.transitions) {
        const k = `${e.from}\u0001${t.read}`;
        const prev = map.get(k);
        const text = `${nm(e.to)}, ${t.write}, ${MOVE_LABEL[t.move]}`;
        map.set(k, prev ? { text: `${prev.text} | ${text}`, edgeId: prev.edgeId, n: prev.n + 1 } : { text, edgeId: e.id, n: 1 });
      }
    return map;
  }, [m]);
  if (m.states.length === 0) return <p className="muted pad">Sem estados.</p>;
  return (
    <div className="pad">
      <p className="muted small">
        Cada célula é δ(q, a) = (r, b, movimento). "—" = sem transição: vai para q_rejeita (p. 152). Estados de parada não têm linha de transições.
      </p>
      <div className="table-scroll">
        <table className="delta">
          <caption className="sr-only">Função de transição da máquina de Turing</caption>
          <thead>
            <tr>
              <th scope="col">δ</th>
              {gamma.map((a) => (
                <th key={a} scope="col" className="mono">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.states.map((s) => {
              const halt = s.id === m.acceptState ? 'q_aceita' : s.id === m.rejectState ? 'q_rejeita' : null;
              return (
                <tr key={s.id}>
                  <th scope="row" className="mono">
                    {m.initial === s.id ? '→ ' : ''}
                    {s.name}
                    {halt && <span className="muted small"> ({halt})</span>}
                  </th>
                  {halt ? (
                    <td colSpan={gamma.length} className="muted small">
                      para (estado de parada)
                    </td>
                  ) : (
                    gamma.map((a) => {
                      const c = cell.get(`${s.id}\u0001${a}`);
                      return (
                        <td key={a} className={`mono${c && c.n > 1 ? ' conflict' : ''}`}>
                          {c ? (
                            <button className="link mono" onClick={() => select({ edges: [c.edgeId] })}>
                              {c.n > 1 ? '✗ ' : ''}
                              {c.text}
                            </button>
                          ) : (
                            <span className="muted" title="sem transição: q_rejeita">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TMFormal() {
  const m = useTM();
  const report = useMemo(() => validateTM(m), [m]);
  const set = (xs: string[]) => (xs.length ? `{${xs.join(', ')}}` : '∅');
  const nm = (id: string | null) => (id ? (m.states.find((s) => s.id === id)?.name ?? '?') : null);
  const Q = m.states.map((s) => s.name);
  if (!m.rejectState) Q.push('q_rejeita');
  const lines: string[] = [];
  for (const e of m.edges) for (const t of e.transitions) lines.push(`δ(${nm(e.from)}, ${t.read}) = (${nm(e.to)}, ${t.write}, ${MOVE_LABEL[t.move]})`);
  return (
    <div className="pad formal">
      <p>
        <strong>MT</strong> M = (Q, Σ, Γ, δ, q0, q_aceita, q_rejeita), onde:
      </p>
      <ol>
        <li>
          Q = <span className="mono">{set(Q)}</span>
          {!m.rejectState && <span className="muted small"> (q_rejeita implícito, não desenhado)</span>}
        </li>
        <li>
          Σ = <span className="mono">{set(m.inputAlphabet)}</span>
        </li>
        <li>
          Γ = <span className="mono">{set(tapeAlphabet(m))}</span>
        </li>
        <li>
          δ: <span className="mono">Q × Γ → Q × Γ × {'{E, D}'}</span>, dada por:
          <ul className="mono delta-lines">
            {lines.length === 0 && <li>(nenhuma transição)</li>}
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
            {lines.length > 0 && <li className="muted">demais pares (q, a) com q não de parada: (q_rejeita, a, D)*</li>}
          </ul>
        </li>
        <li>
          q0 = <span className="mono">{nm(m.initial) ?? '(indefinido)'}</span>
        </li>
        <li>
          q_aceita = <span className="mono">{nm(m.acceptState) ?? '(indefinido)'}</span>
        </li>
        <li>
          q_rejeita = <span className="mono">{nm(m.rejectState) ?? 'q_rejeita (implícito)'}</span>
        </li>
      </ol>
      <p className="muted small">
        * Convenção do livro (p. 152): transições omitidas vão para q_rejeita. O símbolo escrito e o movimento dessas transições implícitas não afetam o resultado, pois a máquina para ao entrar em q_rejeita; o app as completa como "(q_rejeita, a, D)" só para que δ seja total.
      </p>
      {!report.valid && <p className="callout error">A máquina tem erros de validação; esta descrição é de um rascunho.</p>}
      <p className="muted small">Referência: Sipser, Definição 3.3 (p. 146), computação e configurações (p. 146–148).</p>
    </div>
  );
}
