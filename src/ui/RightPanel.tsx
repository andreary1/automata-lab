import { useEffect, useMemo, useRef, useState } from 'react';
import { completeWithSink, deleteEdges, deleteStates, removeSymbolEverywhere, renameSymbol, updateEdge, updateState } from '../core/fa/edit';
import type { FAKind } from '../core/fa/model';
import { formatStateSet } from '../core/fa/model';
import { parseAlphabetText, symbolProblem } from '../core/fa/symbols';
import { transitionTable } from '../core/fa/table';
import { validate, type Issue } from '../core/fa/validate';
import { askConfirm, useApp } from '../state/store';
import { HelpTip } from './HelpTip';
import { Icon } from './icons';

export function RightPanel() {
  const tab = useApp((s) => s.rightTab);
  const setTab = useApp((s) => s.setRightTab);
  return (
    <aside className="panel right" aria-label="Propriedades e validação">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'props'} onClick={() => setTab('props')}>
          Propriedades
        </button>
        <button role="tab" aria-selected={tab === 'table'} onClick={() => setTab('table')}>
          Tabela δ
        </button>
        <button role="tab" aria-selected={tab === 'formal'} onClick={() => setTab('formal')}>
          Definição formal
        </button>
      </div>
      <div className="panel-scroll">
        {tab === 'props' && (
          <>
            <Properties />
            <Validation />
          </>
        )}
        {tab === 'table' && <TableView />}
        {tab === 'formal' && <FormalView />}
      </div>
    </aside>
  );
}

function Properties() {
  const sel = useApp((s) => s.selection);
  const m = useApp((s) => s.project.machine);
  if (sel.states.length === 1 && sel.edges.length === 0) {
    const st = m.states.find((s) => s.id === sel.states[0]);
    if (st) return <StateProps id={st.id} />;
  }
  if (sel.edges.length === 1 && sel.states.length === 0) {
    const e = m.edges.find((x) => x.id === sel.edges[0]);
    if (e) return <EdgeProps id={e.id} />;
  }
  if (sel.states.length + sel.edges.length > 1) return <MultiProps />;
  return <MachineProps />;
}

function MultiProps() {
  const sel = useApp((s) => s.selection);
  const apply = useApp((s) => s.apply);
  const clear = useApp((s) => s.clearSelection);
  return (
    <section className="card">
      <h3>Seleção múltipla</h3>
      <p className="muted">
        {sel.states.length} estado(s) e {sel.edges.length} transição(ões) selecionados. Arraste um estado para mover todos.
      </p>
      <button
        className="btn danger"
        onClick={() => {
          apply((m) => deleteEdges(deleteStates(m, new Set(sel.states)), new Set(sel.edges)));
          clear();
        }}
      >
        <Icon name="trash" /> Excluir seleção
      </button>
    </section>
  );
}

function StateProps({ id }: { id: string }) {
  const m = useApp((s) => s.project.machine);
  const apply = useApp((s) => s.apply);
  const clear = useApp((s) => s.clearSelection);
  const select = useApp((s) => s.select);
  const focusTick = useApp((s) => s.focusNameTick);
  const st = m.states.find((s) => s.id === id)!;
  const [name, setName] = useState(st.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setName(st.name), [st.name, id]);
  useEffect(() => {
    if (focusTick > 0) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [focusTick]);
  const dup = m.states.some((s) => s.id !== id && s.name === name.trim());
  const nameError = name.trim() === '' ? 'O nome não pode ser vazio.' : dup ? 'Já existe um estado com esse nome.' : null;
  const commit = () => {
    if (!nameError && name.trim() !== st.name) apply((mm) => updateState(mm, id, { name: name.trim() }));
  };
  const out = m.edges.filter((e) => e.from === id);
  const inc = m.edges.filter((e) => e.to === id && e.from !== id);
  const nm = (sid: string) => m.states.find((s) => s.id === sid)?.name ?? '?';
  const lab = (e: (typeof m.edges)[number]) => [...e.symbols, ...(e.epsilon ? ['ε'] : [])].join(', ') || '(sem símbolo)';
  return (
    <section className="card">
      <h3>Estado</h3>
      <label className="field">
        <span>Nome</span>
        <input
          ref={ref}
          value={name}
          aria-invalid={!!nameError}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setName(st.name);
          }}
        />
        {nameError && <small className="error-text">{nameError}</small>}
        <small className="muted">O nome é só um rótulo: as transições usam um identificador interno e não quebram ao renomear.</small>
      </label>
      <label className="check">
        <input type="checkbox" checked={m.initial === id} onChange={(e) => apply((mm) => ({ ...mm, initial: e.target.checked ? id : null }))} />
        Estado inicial (q0)
      </label>
      <label className="check">
        <input type="checkbox" checked={st.accepting} onChange={(e) => apply((mm) => updateState(mm, id, { accepting: e.target.checked }))} />
        Estado de aceitação (pertence a F)
      </label>
      <div className="mini-list">
        <h4>Saídas</h4>
        {out.length === 0 && <p className="muted">Nenhuma transição sai deste estado.</p>}
        {out.map((e) => (
          <button key={e.id} className="link-row" onClick={() => select({ edges: [e.id] })}>
            → {nm(e.to)} <span className="mono">[{lab(e)}]</span>
          </button>
        ))}
        {inc.length > 0 && <h4>Entradas</h4>}
        {inc.map((e) => (
          <button key={e.id} className="link-row" onClick={() => select({ edges: [e.id] })}>
            {nm(e.from)} → <span className="mono">[{lab(e)}]</span>
          </button>
        ))}
      </div>
      <button
        className="btn danger"
        onClick={() => {
          apply((mm) => deleteStates(mm, new Set([id])));
          clear();
        }}
      >
        <Icon name="trash" /> Excluir estado
      </button>
    </section>
  );
}

function EdgeProps({ id }: { id: string }) {
  const m = useApp((s) => s.project.machine);
  const apply = useApp((s) => s.apply);
  const clear = useApp((s) => s.clearSelection);
  const select = useApp((s) => s.select);
  const e = m.edges.find((x) => x.id === id)!;
  const nm = (sid: string) => m.states.find((s) => s.id === sid)?.name ?? '?';
  const stray = e.symbols.filter((s) => !m.alphabet.includes(s));
  // Para AFD: mostra se o símbolo já sai da origem para outro destino (conflito).
  const usedElsewhere = (sym: string) => m.edges.find((x) => x.from === e.from && x.id !== e.id && x.symbols.includes(sym));
  const toggle = (sym: string, on: boolean) =>
    apply((mm) => {
      const cur = mm.edges.find((x) => x.id === id)!;
      const symbols = on ? m.alphabet.filter((a) => a === sym || cur.symbols.includes(a)).concat(cur.symbols.filter((s) => !m.alphabet.includes(s))) : cur.symbols.filter((s) => s !== sym);
      return updateEdge(mm, id, { symbols });
    });
  return (
    <section className="card">
      <h3>Transição</h3>
      <p className="edge-title">
        <button className="link" onClick={() => select({ states: [e.from] })}>
          {nm(e.from)}
        </button>{' '}
        →{' '}
        <button className="link" onClick={() => select({ states: [e.to] })}>
          {nm(e.to)}
        </button>
        {e.from === e.to && <span className="tag">laço</span>}
      </p>
      <fieldset className="symbols">
        <legend>Símbolos lidos nesta transição</legend>
        {m.alphabet.length === 0 && <p className="muted">Σ está vazio. Adicione símbolos ao alfabeto (clique no canvas vazio para ver a máquina).</p>}
        <div className="symbol-grid">
          {m.alphabet.map((a) => {
            const other = m.kind === 'dfa' ? usedElsewhere(a) : undefined;
            const checked = e.symbols.includes(a);
            return (
              <label key={a} className={`sym-check${checked && other ? ' conflict' : ''}`} title={other ? `"${a}" também leva de ${nm(e.from)} para ${nm(other.to)}` : undefined}>
                <input type="checkbox" checked={checked} onChange={(ev) => toggle(a, ev.target.checked)} />
                <span className="mono">{a}</span>
                {other && <small>{checked ? '⚠ conflito' : `→ ${nm(other.to)}`}</small>}
              </label>
            );
          })}
          <label className={`sym-check eps${m.kind === 'dfa' && !e.epsilon ? ' disabled' : ''}`}>
            <input type="checkbox" checked={e.epsilon} disabled={m.kind === 'dfa' && !e.epsilon} onChange={(ev) => apply((mm) => updateEdge(mm, id, { epsilon: ev.target.checked }))} />
            <span className="mono">ε</span>
            <HelpTip topic="epsilon" />
          </label>
        </div>
        {m.kind === 'dfa' && <small className="muted">AFD não admite ε. Para usar ε, mude o tipo da máquina para AFN.</small>}
      </fieldset>
      {stray.length > 0 && (
        <div className="callout error">
          Símbolos fora de Σ nesta transição: <span className="mono">{stray.join(', ')}</span>.
          <div className="row">
            <button className="btn small" onClick={() => apply((mm) => ({ ...mm, alphabet: [...mm.alphabet, ...stray] }))}>
              Adicionar a Σ
            </button>
            <button className="btn small" onClick={() => apply((mm) => updateEdge(mm, id, { symbols: e.symbols.filter((s) => m.alphabet.includes(s)) }))}>
              Remover da transição
            </button>
          </div>
        </div>
      )}
      <button
        className="btn danger"
        onClick={() => {
          apply((mm) => deleteEdges(mm, new Set([id])));
          clear();
        }}
      >
        <Icon name="trash" /> Excluir transição
      </button>
    </section>
  );
}

function MachineProps() {
  const m = useApp((s) => s.project.machine);
  const project = useApp((s) => s.project);
  const apply = useApp((s) => s.apply);
  const setMeta = useApp((s) => s.setProjectMeta);
  const [symText, setSymText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ sym: string; value: string } | null>(null);

  const add = () => {
    const { symbols, errors } = parseAlphabetText(symText);
    const fresh = symbols.filter((s) => !m.alphabet.includes(s));
    if (errors.length) setErr(errors.join(' '));
    else setErr(symbols.length && !fresh.length ? 'Esses símbolos já estão em Σ.' : null);
    if (fresh.length) {
      apply((mm) => ({ ...mm, alphabet: [...mm.alphabet, ...fresh] }));
      setSymText('');
    }
  };
  const used = (sym: string) => m.edges.some((e) => e.symbols.includes(sym));
  const setKind = (k: FAKind) => apply((mm) => ({ ...mm, kind: k }));

  return (
    <section className="card">
      <h3>Máquina</h3>
      <label className="field">
        <span>Nome do projeto</span>
        <input value={project.name} onChange={(e) => setMeta({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>Descrição</span>
        <textarea rows={2} value={project.description} onChange={(e) => setMeta({ description: e.target.value })} placeholder="Ex.: linguagem reconhecida, exercício, observações" />
      </label>
      <div className="field">
        <span>
          Tipo <HelpTip topic="nondeterminism" />
        </span>
        <div className="segmented" role="radiogroup" aria-label="Tipo de máquina">
          <button role="radio" aria-checked={m.kind === 'dfa'} onClick={() => setKind('dfa')}>
            AFD
          </button>
          <button role="radio" aria-checked={m.kind === 'nfa'} onClick={() => setKind('nfa')}>
            AFN
          </button>
        </div>
        <small className="muted">
          {m.kind === 'dfa'
            ? 'AFD (Def. 1.5): δ: Q × Σ → Q — exatamente um destino por par (estado, símbolo), sem ε.'
            : 'AFN (Def. 1.37): δ: Q × Σε → P(Q) — zero, um ou vários destinos; transições ε permitidas.'}{' '}
          Mudar o tipo não altera estados e transições; só muda as regras de validação.
        </small>
      </div>
      <div className="field">
        <span>Alfabeto Σ</span>
        <div className="chips">
          {m.alphabet.length === 0 && <span className="muted">Σ = ∅</span>}
          {m.alphabet.map((a) =>
            editing?.sym === a ? (
              <input
                key={a}
                className="chip-input"
                autoFocus
                value={editing.value}
                onChange={(e) => setEditing({ sym: a, value: e.target.value })}
                onBlur={() => {
                  const v = editing.value.trim();
                  const p = symbolProblem(v);
                  if (v !== a) {
                    if (p) setErr(p);
                    else if (m.alphabet.includes(v)) setErr(`"${v}" já está em Σ.`);
                    else {
                      apply((mm) => renameSymbol(mm, a, v));
                      setErr(null);
                    }
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
                  aria-label={`Remover ${a} de Σ`}
                  onClick={async () => {
                    if (used(a) && !(await askConfirm(`"${a}" é usado em transições. Remover de Σ e de todas as transições? (Pode ser desfeito com Ctrl+Z.)`, 'Remover'))) return;
                    apply((mm) => removeSymbolEverywhere(mm, a));
                  }}
                >
                  ×
                </button>
              </span>
            ),
          )}
        </div>
        <div className="row">
          <input
            value={symText}
            onChange={(e) => setSymText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="novo(s) símbolo(s): a, b"
            aria-label="Adicionar símbolos ao alfabeto"
          />
          <button className="btn small" onClick={add}>
            Adicionar
          </button>
        </div>
        {err && <small className="error-text">{err}</small>}
        <small className="muted">
          Símbolos de vários caracteres são permitidos (ex.: RESET); nesse caso a entrada é escrita com símbolos separados por espaço. ε e ∅ são reservados.
        </small>
      </div>
      <p className="muted small">
        {m.states.length} estado(s), {m.edges.length} aresta(s). Clique em um estado ou transição para editá-lo.
      </p>
    </section>
  );
}

function Validation() {
  const m = useApp((s) => s.project.machine);
  const apply = useApp((s) => s.apply);
  const select = useApp((s) => s.select);
  const report = useMemo(() => validate(m), [m]);
  const order = { error: 0, warning: 1, info: 2 } as const;
  const issues = [...report.issues].sort((a, b) => order[a.severity] - order[b.severity]);
  const label = { error: 'Erro', warning: 'Aviso', info: 'Info' } as const;
  return (
    <section className="card" aria-live="polite">
      <h3>
        Validação{' '}
        <span className={`badge ${report.valid ? 'ok' : 'bad'}`}>
          {report.valid ? (report.incompleteDfa ? '✓ válida (AFD incompleto)' : `✓ ${m.kind === 'dfa' ? 'AFD' : 'AFN'} válido`) : '✗ com erros'}
        </span>
      </h3>
      {issues.length === 0 && <p className="muted">Nenhum problema encontrado.</p>}
      <ul className="issues">
        {issues.map((i, k) => (
          <IssueItem key={k} issue={i} label={label[i.severity]} onShow={() => select({ states: i.stateIds ?? [], edges: i.edgeIds ?? [] })}>
            {i.code === 'dfa-missing' && (
              <button
                className="btn small"
                onClick={() => {
                  let sink: string | null = null;
                  apply((mm) => {
                    const r = completeWithSink(mm);
                    sink = r.sinkId;
                    return r.machine;
                  });
                  if (sink) select({ states: [sink] });
                }}
              >
                Completar com estado poço
              </button>
            )}
            {i.code === 'dfa-missing' && <HelpTip topic="sink" />}
            {i.code === 'dfa-epsilon' || i.code === 'dfa-conflict' ? (
              <button className="btn small" onClick={() => apply((mm) => ({ ...mm, kind: 'nfa' }))}>
                Mudar para AFN
              </button>
            ) : null}
          </IssueItem>
        ))}
      </ul>
    </section>
  );
}

function IssueItem({ issue, label, onShow, children }: { issue: Issue; label: string; onShow: () => void; children?: React.ReactNode }) {
  const hasTarget = (issue.stateIds?.length ?? 0) + (issue.edgeIds?.length ?? 0) > 0;
  return (
    <li className={`issue ${issue.severity}`}>
      <div className="issue-head">
        <span className="sev">
          {issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '!' : 'i'} {label}
        </span>
        {hasTarget && (
          <button className="link small" onClick={onShow}>
            mostrar
          </button>
        )}
      </div>
      <p>{issue.message}</p>
      <p className="fix">
        <strong>Como resolver:</strong> {issue.fix}
      </p>
      {children && <div className="row">{children}</div>}
    </li>
  );
}

function TableView() {
  const m = useApp((s) => s.project.machine);
  const select = useApp((s) => s.select);
  const t = useMemo(() => transitionTable(m), [m]);
  const name = (id: string) => m.states.find((s) => s.id === id)?.name ?? '?';
  if (m.states.length === 0) return <p className="muted pad">Sem estados.</p>;
  return (
    <div className="pad">
      <p className="muted small">
        Derivada do mesmo modelo que o diagrama. → indica o estado inicial; * indica estado de aceitação.
        {m.kind === 'dfa' ? ' Em AFD, cada célula deve ter exatamente um estado.' : ' Em AFN, cada célula é um conjunto de estados (∅ = nenhum).'}
      </p>
      <div className="table-scroll">
        <table className="delta">
          <caption className="sr-only">Tabela de transições δ</caption>
          <thead>
            <tr>
              <th scope="col">δ</th>
              {t.columns.map((c) => (
                <th key={c.key} scope="col" className="mono">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.stateId}>
                <th scope="row">
                  <button className="link mono" onClick={() => select({ states: [r.stateId] })}>
                    {r.initial ? '→' : ''}
                    {r.accepting ? '*' : ''}
                    {r.name}
                  </button>
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className={`mono ${c.problem ?? ''}`}>
                    {m.kind === 'dfa' && t.columns[i].key !== ''
                      ? c.targets.length === 1
                        ? name(c.targets[0])
                        : c.targets.length === 0
                          ? '— ausente'
                          : `{${c.targets.map(name).join(', ')}} ⚠ conflito`
                      : formatStateSet(m, c.targets)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormalView() {
  const m = useApp((s) => s.project.machine);
  const t = useMemo(() => transitionTable(m), [m]);
  const report = useMemo(() => validate(m), [m]);
  const Q = m.states.map((s) => s.name);
  const F = m.states.filter((s) => s.accepting).map((s) => s.name);
  const q0 = m.initial ? m.states.find((s) => s.id === m.initial)?.name : undefined;
  const set = (xs: string[]) => (xs.length ? `{${xs.join(', ')}}` : '∅');
  const name = (id: string) => m.states.find((s) => s.id === id)?.name ?? '?';
  const lines: string[] = [];
  for (const r of t.rows)
    r.cells.forEach((c, i) => {
      const col = t.columns[i];
      if (m.kind === 'dfa' && col.key !== '') {
        if (c.targets.length === 1) lines.push(`δ(${r.name}, ${col.label}) = ${name(c.targets[0])}`);
      } else if (c.targets.length) lines.push(`δ(${r.name}, ${col.label}) = ${formatStateSet(m, c.targets)}`);
    });
  return (
    <div className="pad formal">
      <p>
        <strong>{m.kind === 'dfa' ? 'AFD' : 'AFN'}</strong> M = (Q, Σ, δ, q0, F), onde:
      </p>
      <ol>
        <li>
          Q = <span className="mono">{set(Q)}</span>
        </li>
        <li>
          Σ = <span className="mono">{set(m.alphabet)}</span>
        </li>
        <li>
          δ: <span className="mono">{m.kind === 'dfa' ? 'Q × Σ → Q' : 'Q × Σε → P(Q)'}</span>, dada por:
          <ul className="mono delta-lines">
            {lines.length === 0 && <li>(nenhuma transição)</li>}
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
            {m.kind === 'nfa' && lines.length > 0 && <li className="muted">pares omitidos: δ = ∅</li>}
          </ul>
        </li>
        <li>
          q0 = <span className="mono">{q0 ?? '(indefinido)'}</span>
        </li>
        <li>
          F = <span className="mono">{set(F)}</span>
        </li>
      </ol>
      {!report.valid && <p className="callout error">A máquina tem erros de validação; esta descrição é de um rascunho e ainda não satisfaz a definição formal.</p>}
      {report.incompleteDfa && <p className="callout warn">δ não está definida para todos os pares: pela Def. 1.5 isto ainda não é um AFD completo.</p>}
      <p className="muted small">Referência: Sipser, Definição 1.5 (AFD, p. 36) e Definição 1.37 (AFN, p. 55).</p>
    </div>
  );
}

