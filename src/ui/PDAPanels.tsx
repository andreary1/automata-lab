import { useEffect, useMemo, useState } from 'react';
import { deleteEdges } from '../core/fa/edit';
import { parseAlphabetText, symbolProblem, tokenize } from '../core/fa/symbols';
import type { PDA, PDATransition } from '../core/pda/model';
import { formatStack, transitionLabel } from '../core/pda/model';
import { addTransition, removeInputSymbol, removeStackSymbol, removeTransition, renameInputSymbol, renameStackSymbol, suggestTransition, updateTransition, usesOf } from '../core/pda/edit';
import { validatePDA } from '../core/pda/validate';
import { askConfirm, useApp } from '../state/store';
import { HelpTip } from './HelpTip';
import { Icon } from './icons';

const usePDA = () => useApp((s) => s.project.machine) as PDA;

// ---------------------------------------------------------------- alfabetos
export function SymbolSetEditor({ label, symbols, onAdd, onRemove, onRename, uses, help, check, id: idProp }: { label: string; symbols: string[]; onAdd: (s: string[]) => void; onRemove: (s: string) => void; onRename: (a: string, b: string) => void; uses: (s: string) => number; help: string; check?: (s: string) => string | null; id?: string }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ sym: string; value: string } | null>(null);
  const add = () => {
    const { symbols: parsed, errors } = parseAlphabetText(text);
    const extra = check ? parsed.map(check).filter((x): x is string => !!x) : [];
    const fresh = parsed.filter((s) => !symbols.includes(s) && !check?.(s));
    const all = [...errors, ...extra];
    setErr(all.length ? all.join(' ') : parsed.length && !fresh.length ? `Esses símbolos já estão em ${label}.` : null);
    if (fresh.length) {
      onAdd(fresh);
      setText('');
    }
  };
  const id = idProp ?? `alpha-${label}`;
  return (
    <div className="field">
      <span>
        <label htmlFor={id}>{label}</label>
      </span>
      <div className="chips">
        {symbols.length === 0 && <span className="muted">{label} = ∅</span>}
        {symbols.map((a) =>
          editing?.sym === a ? (
            <input
              key={a}
              className="chip-input"
              autoFocus
              aria-label={`Renomear ${a}`}
              value={editing.value}
              onChange={(e) => setEditing({ sym: a, value: e.target.value })}
              onBlur={() => {
                const v = editing.value.trim();
                if (v !== a) {
                  const p = symbolProblem(v) ?? check?.(v) ?? null;
                  if (p) setErr(p);
                  else if (symbols.includes(v)) setErr(`"${v}" já está em ${label}.`);
                  else onRename(a, v), setErr(null);
                }
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditing(null);
              }}
            />
          ) : (
            <span key={a} className="chip">
              <button className="chip-label mono" title="Renomear símbolo" onClick={() => setEditing({ sym: a, value: a })}>
                {a}
              </button>
              <button
                className="chip-x"
                aria-label={`Remover ${a} de ${label}`}
                onClick={async () => {
                  const n = uses(a);
                  if (n && !(await askConfirm(`"${a}" aparece em ${n} transição(ões). Remover de ${label} e excluir essas transições? (Ctrl+Z desfaz.)`, 'Remover'))) return;
                  onRemove(a);
                }}
              >
                ×
              </button>
            </span>
          ),
        )}
      </div>
      <div className="row">
        <input id={id} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="novo(s) símbolo(s)" />
        <button className="btn small" onClick={add}>
          Adicionar
        </button>
      </div>
      {err && <small className="error-text">{err}</small>}
      <small className="muted">{help}</small>
    </div>
  );
}

// ---------------------------------------------------------------- máquina
export function PDAMachineProps() {
  const m = usePDA();
  const project = useApp((s) => s.project);
  const st = useApp.getState();
  const [stackText, setStackText] = useState(formatStack(m.initialStack, m.stackAlphabet).replace(/^ε$/, ''));
  const [stackErr, setStackErr] = useState<string | null>(null);
  useEffect(() => setStackText(formatStack(m.initialStack, m.stackAlphabet).replace(/^ε$/, '')), [m.initialStack, m.stackAlphabet]);
  const commitStack = () => {
    const tk = tokenize(stackText, m.stackAlphabet);
    if (!tk.ok) return setStackErr(tk.error.replace('Σ', 'Γ'));
    setStackErr(null);
    st.applyPDA((mm) => ({ ...mm, initialStack: tk.tokens }));
  };
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
        <strong>Autômato com pilha</strong> (Def. 2.13): δ: Q × Σε × Γε → P(Q × Γε). Cada transição lê um símbolo de Σ ou ε, desempilha um símbolo de Γ ou ε e empilha uma cadeia de Γ (ε = nada).
      </p>
      <SymbolSetEditor
        label="Σ"
        symbols={m.inputAlphabet}
        uses={(a) => usesOf(m, a, 'input')}
        onAdd={(syms) => st.applyPDA((mm) => ({ ...mm, inputAlphabet: [...mm.inputAlphabet, ...syms] }))}
        onRemove={(a) => st.applyPDA((mm) => removeInputSymbol(mm, a))}
        onRename={(a, b) => st.applyPDA((mm) => renameInputSymbol(mm, a, b))}
        help="Alfabeto de entrada."
      />
      <SymbolSetEditor
        label="Γ"
        symbols={m.stackAlphabet}
        uses={(a) => usesOf(m, a, 'stack')}
        onAdd={(syms) => st.applyPDA((mm) => ({ ...mm, stackAlphabet: [...mm.stackAlphabet, ...syms] }))}
        onRemove={(a) => st.applyPDA((mm) => removeStackSymbol(mm, a))}
        onRename={(a, b) => st.applyPDA((mm) => renameStackSymbol(mm, a, b))}
        help="Alfabeto da pilha. Pode compartilhar símbolos com Σ. É comum usar $ para marcar o fundo."
      />
      <div className="field">
        <span>
          Aceitação <HelpTip topic="pdaAcceptance" />
        </span>
        <div className="segmented" role="radiogroup" aria-label="Modo de aceitação">
          <button role="radio" aria-checked={m.acceptance === 'final'} onClick={() => st.applyPDA((mm) => ({ ...mm, acceptance: 'final' }))}>
            Estado final (livro)
          </button>
          <button role="radio" aria-checked={m.acceptance === 'empty'} onClick={() => st.applyPDA((mm) => ({ ...mm, acceptance: 'empty' }))}>
            Pilha vazia
          </button>
        </div>
        <small className="muted">
          {m.acceptance === 'final'
            ? 'Padrão do Sipser: aceita se algum ramo termina de ler a entrada num estado de aceitação. O conteúdo da pilha não importa.'
            : 'Modo separado (não é o do livro): aceita se algum ramo termina de ler a entrada com a pilha vazia. F é ignorado.'}
        </small>
      </div>
      <div className="field">
        <span>
          <label htmlFor="initial-stack">Pilha inicial (topo à esquerda)</label>
        </span>
        <input id="initial-stack" className="mono" value={stackText} placeholder="vazia (padrão do livro)" onChange={(e) => setStackText(e.target.value)} onBlur={commitStack} onKeyDown={(e) => e.key === 'Enter' && commitStack()} />
        {stackErr && <small className="error-text">{stackErr}</small>}
        <small className="muted">No livro a pilha começa vazia (s₀ = ε). Útil sobretudo no modo pilha vazia (ex.: Z).</small>
      </div>
      <p className="muted small">
        {m.states.length} estado(s), {m.edges.reduce((a, e) => a + e.transitions.length, 0)} transição(ões) em {m.edges.length} seta(s).
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- seta (várias transições)
function PushField({ t, gamma, onCommit }: { t: PDATransition; gamma: string[]; onCommit: (push: string[]) => void }) {
  const shown = t.push.length ? formatStack(t.push, gamma) : '';
  const [text, setText] = useState(shown);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const tk = tokenize(text, gamma);
    if (!tk.ok) return setErr(tk.error.replace('Σ', 'Γ'));
    setErr(null);
    if (tk.tokens.join('\u0000') !== t.push.join('\u0000')) onCommit(tk.tokens);
  };
  return (
    <div className="push-field">
      <input
        className="mono"
        aria-label="Empilha (vazio = ε)"
        aria-invalid={!!err}
        value={text}
        placeholder="ε"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {err && <small className="error-text">{err}</small>}
    </div>
  );
}

export function PDAEdgeProps({ id }: { id: string }) {
  const m = usePDA();
  const st = useApp.getState();
  const e = m.edges.find((x) => x.id === id)!;
  const nm = (sid: string) => m.states.find((s) => s.id === sid)?.name ?? '?';
  const upd = (tid: string, patch: Partial<Omit<PDATransition, 'id'>>) => st.applyPDA((mm) => updateTransition(mm, id, tid, patch));
  const opt = (list: string[], v: string | null) => (v !== null && !list.includes(v) ? [...list, v] : list);
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
        Cada linha é uma transição "a, b → c": lê <em>a</em> (ou ε), desempilha <em>b</em> do topo (ou ε) e empilha <em>c</em> (ou ε). Ao empilhar vários símbolos, o primeiro escrito fica no topo.
      </p>
      <div className="pda-trans">
        <div className="pda-trans-head" aria-hidden="true">
          <span>Lê</span>
          <span>Desempilha</span>
          <span>Empilha</span>
          <span />
        </div>
        {e.transitions.map((t) => (
          <div key={t.id} className="pda-trans-row" role="group" aria-label={`Transição ${transitionLabel(t, m.stackAlphabet)}`}>
            <select aria-label="Lê" value={t.read ?? ''} onChange={(ev) => upd(t.id, { read: ev.target.value === '' ? null : ev.target.value })}>
              <option value="">ε</option>
              {opt(m.inputAlphabet, t.read).map((a) => (
                <option key={a} value={a}>
                  {a}
                  {!m.inputAlphabet.includes(a) ? ' (fora de Σ)' : ''}
                </option>
              ))}
            </select>
            <select aria-label="Desempilha" value={t.pop ?? ''} onChange={(ev) => upd(t.id, { pop: ev.target.value === '' ? null : ev.target.value })}>
              <option value="">ε</option>
              {opt(m.stackAlphabet, t.pop).map((a) => (
                <option key={a} value={a}>
                  {a}
                  {!m.stackAlphabet.includes(a) ? ' (fora de Γ)' : ''}
                </option>
              ))}
            </select>
            <PushField t={t} gamma={m.stackAlphabet} onCommit={(push) => upd(t.id, { push })} />
            <button className="btn small ghost" aria-label={`Excluir transição ${transitionLabel(t, m.stackAlphabet)}`} title="Excluir transição" onClick={() => st.applyPDA((mm) => removeTransition(mm, id, t.id))}>
              <Icon name="x" />
            </button>
          </div>
        ))}
        {e.transitions.length === 0 && <p className="muted small">Nenhuma transição nesta seta.</p>}
      </div>
      <div className="row wrap">
        <button className="btn small" onClick={() => st.applyPDA((mm) => addTransition(mm, id, suggestTransition(mm)).machine)}>
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
interface Row {
  from: string;
  read: string;
  pop: string;
  to: string;
  push: string;
  edgeId: string;
}
function rowsOf(m: PDA): Row[] {
  const order = new Map(m.states.map((s, i) => [s.id, i]));
  const nm = (id: string) => m.states.find((s) => s.id === id)?.name ?? '?';
  return m.edges
    .flatMap((e) => e.transitions.map((t) => ({ e, t })))
    .sort((a, b) => order.get(a.e.from)! - order.get(b.e.from)!)
    .map(({ e, t }) => ({ from: nm(e.from), read: t.read ?? 'ε', pop: t.pop ?? 'ε', to: nm(e.to), push: formatStack(t.push, m.stackAlphabet), edgeId: e.id }));
}

export function PDATable() {
  const m = usePDA();
  const select = useApp((s) => s.select);
  const rows = useMemo(() => rowsOf(m), [m]);
  if (rows.length === 0) return <p className="muted pad">Sem transições.</p>;
  return (
    <div className="pad">
      <p className="muted small">Cada linha é um par (r, c) ∈ δ(q, a, b). ε em "lê" = não lê; em "desempilha" = não desempilha; em "empilha" = não empilha. Pilha com topo à esquerda.</p>
      <div className="table-scroll">
        <table className="delta">
          <caption className="sr-only">Transições do autômato com pilha</caption>
          <thead>
            <tr>
              <th scope="col">q</th>
              <th scope="col">lê a</th>
              <th scope="col">desempilha b</th>
              <th scope="col">r</th>
              <th scope="col">empilha c</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">
                  <button className="link mono" onClick={() => select({ edges: [r.edgeId] })}>
                    {r.from}
                  </button>
                </th>
                <td className="mono">{r.read}</td>
                <td className="mono">{r.pop}</td>
                <td className="mono">{r.to}</td>
                <td className="mono">{r.push}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PDAFormal() {
  const m = usePDA();
  const report = useMemo(() => validatePDA(m), [m]);
  const set = (xs: string[]) => (xs.length ? `{${xs.join(', ')}}` : '∅');
  const nm = (id: string) => m.states.find((s) => s.id === id)?.name ?? '?';
  const groups = new Map<string, string[]>();
  for (const e of m.edges)
    for (const t of e.transitions) {
      const k = `δ(${nm(e.from)}, ${t.read ?? 'ε'}, ${t.pop ?? 'ε'})`;
      groups.set(k, [...(groups.get(k) ?? []), `(${nm(e.to)}, ${formatStack(t.push, m.stackAlphabet)})`]);
    }
  return (
    <div className="pad formal">
      <p>
        <strong>AP</strong> M = (Q, Σ, Γ, δ, q0, F), onde:
      </p>
      <ol>
        <li>
          Q = <span className="mono">{set(m.states.map((s) => s.name))}</span>
        </li>
        <li>
          Σ = <span className="mono">{set(m.inputAlphabet)}</span>
        </li>
        <li>
          Γ = <span className="mono">{set(m.stackAlphabet)}</span>
        </li>
        <li>
          δ: <span className="mono">Q × Σε × Γε → P(Q × Γε)</span>, dada por:
          <ul className="mono delta-lines">
            {groups.size === 0 && <li>(nenhuma transição)</li>}
            {[...groups].map(([k, v]) => (
              <li key={k}>
                {k} = {`{${v.join(', ')}}`}
              </li>
            ))}
            {groups.size > 0 && <li className="muted">demais combinações: ∅</li>}
          </ul>
        </li>
        <li>
          q0 = <span className="mono">{m.initial ? nm(m.initial) : '(indefinido)'}</span>
        </li>
        <li>
          F = <span className="mono">{set(m.states.filter((s) => s.accepting).map((s) => s.name))}</span>
        </li>
      </ol>
      <p className="muted small">
        Aceitação: {m.acceptance === 'final' ? 'por estado final ao fim da entrada (padrão do livro)' : 'por pilha vazia ao fim da entrada (modo separado; F é ignorado)'}. Pilha inicial: <span className="mono">{formatStack(m.initialStack, m.stackAlphabet)}</span>
        {m.initialStack.length === 0 ? ' (como no livro, s₀ = ε)' : ''}.
      </p>
      {m.edges.some((e) => e.transitions.some((t) => t.push.length > 1)) && <p className="callout info">Transições que empilham mais de um símbolo usam a abreviação da Figura 2.23; o primeiro símbolo escrito fica no topo.</p>}
      {!report.valid && <p className="callout error">A máquina tem erros de validação; esta descrição é de um rascunho.</p>}
      <p className="muted small">Referência: Sipser, Definição 2.13 (p. 116) e definição formal de computação (p. 116–117).</p>
    </div>
  );
}
