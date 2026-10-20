import { useEffect, useMemo, useState } from 'react';
import type { OpError, Operand, BinaryOp, EquivalenceOutput, MachineResult, SubsetTable, ToRegexOutput } from '../core/regular/api';
import { fullyParenthesized, parseRegex, RegexSyntaxError } from '../core/regular/regex';
import type { RegularRequest } from '../core/regular/requests';
import type { FiniteAutomaton } from '../core/fa/model';
import { isFA, type Machine } from '../core/machine';
import { parseAlphabetText } from '../core/fa/symbols';
import { validate } from '../core/fa/validate';
import { newProject } from '../core/persistence/schema';
import { runRegular } from '../state/regularRunner';
import { projectStore, useApp } from '../state/store';
import { Icon } from './icons';
import { Modal } from './Dialogs';

type Tool = 'nfaToDfa' | 'minimize' | 'regexToNfa' | 'toRegex' | 'ops' | 'equivalence';

const TOOLS: { id: Tool; title: string; ref: string; desc: string }[] = [
  { id: 'nfaToDfa', title: 'AFN → AFD', ref: 'Teorema 1.39', desc: 'Construção dos subconjuntos, com fecho-ε.' },
  { id: 'minimize', title: 'Minimizar AFD', ref: 'complementar', desc: 'Remove inalcançáveis e junta estados indistinguíveis.' },
  { id: 'regexToNfa', title: 'ER → AFN', ref: 'Lema 1.55', desc: 'Monta um AFN a partir de uma expressão regular.' },
  { id: 'toRegex', title: 'AF → ER', ref: 'Lema 1.60', desc: 'Elimina estados de um AFNG até restar uma expressão.' },
  { id: 'ops', title: 'Operações', ref: 'Teoremas 1.25, 1.45–1.49', desc: 'União, interseção, diferença, complemento, concatenação e estrela.' },
  { id: 'equivalence', title: 'Equivalência', ref: 'Teorema 4.5', desc: 'Decide se duas linguagens são iguais; mostra contraexemplo.' },
];

type OperandChoice = { mode: 'current' } | { mode: 'project'; id: string } | { mode: 'regex'; src: string; sigma: string };

type Result =
  | { tool: 'nfaToDfa'; data: MachineResult & { table: SubsetTable; possible: number } }
  | { tool: 'minimize'; data: MachineResult & { rounds: string[][][]; blocks: string[][]; removed: string[]; before: number; after: number } }
  | { tool: 'regexToNfa'; data: MachineResult & { parsed: string; full: string; alphabet: string[] }; src: string }
  | { tool: 'toRegex'; data: ToRegexOutput }
  | { tool: 'ops'; data: MachineResult; title: string }
  | { tool: 'equivalence'; data: EquivalenceOutput; aIsCurrent: boolean; bIsCurrent: boolean };

/** Alfabeto de entrada para pré-preencher campos (AF: Σ; AP: Σ de entrada). */
const sigmaOf = (m: Machine) => (isFA(m) ? m.alphabet : m.inputAlphabet);

export function RegularDialog() {
  const st = useApp.getState();
  const project = useApp((s) => s.project);
  const currentFA = isFA(project.machine) ? project.machine : null;
  const [tool, setTool] = useState<Tool>('nfaToDfa');
  const [maxStates, setMaxStates] = useState(5000);
  const [running, setRunning] = useState<{ cancel: () => void } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<OpError | null>(null);

  // formulário
  const [regex, setRegex] = useState('(ab ∪ a)*');
  const [sigmaText, setSigmaText] = useState(sigmaOf(project.machine).join(', '));
  const [inferSigma, setInferSigma] = useState(false);
  const [simplify, setSimplify] = useState(true);
  const [order, setOrder] = useState<'heuristic' | 'listed'>('heuristic');
  const [op, setOp] = useState<BinaryOp | 'star' | 'complement'>('union');
  const [opA, setOpA] = useState<OperandChoice>(currentFA ? { mode: 'current' } : { mode: 'regex', src: '', sigma: sigmaOf(project.machine).join(', ') });
  const [opB, setOpB] = useState<OperandChoice>({ mode: 'regex', src: '', sigma: sigmaOf(project.machine).join(', ') });
  const [complementSigma, setComplementSigma] = useState(sigmaOf(project.machine).join(', '));

  const close = () => {
    running?.cancel();
    st.setDialog(null);
  };
  const currentValid = useMemo(() => (currentFA ? validate(currentFA) : { valid: false, issues: [], incompleteDfa: false }), [currentFA]);
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [tool]);

  const budget = { maxStates, maxRegexLength: 200_000 };

  const toOperand = (c: OperandChoice): Operand | string => {
    if (c.mode === 'current') {
      if (!currentFA) return `o projeto atual é ${project.machine.kind === 'tm' ? 'uma máquina de Turing' : 'um autômato com pilha'}; estas ferramentas trabalham com autômatos finitos.`;
      return { kind: 'machine', machine: currentFA, label: project.name || 'projeto atual' };
    }
    if (c.mode === 'project') {
      const p = projectStore.load(c.id);
      if (!p) return 'Não foi possível carregar o projeto escolhido.';
      if (!isFA(p.machine)) return `"${p.name}" não é um autômato finito (é ${p.machine.kind === 'tm' ? 'uma máquina de Turing' : 'um autômato com pilha'}); escolha um autômato finito.`;
      return { kind: 'machine', machine: p.machine, label: p.name };
    }
    if (!c.src.trim()) return 'Escreva a expressão regular.';
    const { symbols, errors } = parseAlphabetText(c.sigma);
    if (errors.length) return errors.join(' ');
    return { kind: 'regex', src: c.src, alphabet: symbols, label: c.src };
  };

  async function run(req: RegularRequest, make: (r: unknown) => Result) {
    setResult(null);
    setError(null);
    const job = runRegular<unknown>({ ...req, budget });
    setRunning(job);
    const out = await job.promise;
    setRunning(null);
    if (out.ok) setResult(make(out.result));
    else setError(out.error);
  }

  const execute = () => {
    const label = project.name || 'projeto atual';
    switch (tool) {
      case 'nfaToDfa':
        if (!currentFA) return;
        return run({ op: 'nfaToDfa', machine: currentFA, label }, (r) => ({ tool, data: r as never }));
      case 'minimize':
        if (!currentFA) return;
        return run({ op: 'minimize', machine: currentFA, label }, (r) => ({ tool, data: r as never }));
      case 'toRegex':
        if (!currentFA) return;
        return run({ op: 'toRegex', machine: currentFA, label, simplify, order }, (r) => ({ tool, data: r as ToRegexOutput }));
      case 'regexToNfa': {
        let alphabet: string[] | null = null;
        if (!inferSigma) {
          const p = parseAlphabetText(sigmaText);
          if (p.errors.length) return setError({ kind: 'invalid', message: p.errors.join(' ') });
          alphabet = p.symbols;
        }
        return run({ op: 'regexToNfa', src: regex, alphabet }, (r) => ({ tool, data: r as never, src: regex }));
      }
      case 'ops': {
        const a = toOperand(opA);
        if (typeof a === 'string') return setError({ kind: 'invalid', message: `Operando A: ${a}` });
        if (op === 'star') return run({ op: 'star', a }, (r) => ({ tool, data: r as MachineResult, title: `(${a.label})*` }));
        if (op === 'complement') {
          const p = parseAlphabetText(complementSigma);
          if (p.errors.length || p.symbols.length === 0) return setError({ kind: 'invalid', message: p.errors.join(' ') || 'Informe Σ para o complemento.' });
          return run({ op: 'complement', a, alphabet: p.symbols }, (r) => ({ tool, data: r as MachineResult, title: `complemento de ${a.label}` }));
        }
        const b = toOperand(opB);
        if (typeof b === 'string') return setError({ kind: 'invalid', message: `Operando B: ${b}` });
        const sym = { union: '∪', concat: '∘', intersection: '∩', difference: '−' }[op];
        return run({ op: 'binary', kind: op, a, b }, (r) => ({ tool, data: r as MachineResult, title: `${a.label} ${sym} ${b.label}` }));
      }
      case 'equivalence': {
        const a = toOperand(opA);
        if (typeof a === 'string') return setError({ kind: 'invalid', message: `A: ${a}` });
        const b = toOperand(opB);
        if (typeof b === 'string') return setError({ kind: 'invalid', message: `B: ${b}` });
        return run({ op: 'equivalence', a, b }, (r) => ({ tool, data: r as EquivalenceOutput, aIsCurrent: opA.mode === 'current', bIsCurrent: opB.mode === 'current' }));
      }
    }
  };

  const needsCurrent = tool === 'nfaToDfa' || tool === 'minimize' || tool === 'toRegex';
  const info = TOOLS.find((t) => t.id === tool)!;

  const openAsProject = (machine: FiniteAutomaton, name: string, description: string, keepTests: boolean, rename: boolean) => {
    let m = machine;
    let desc = description;
    if (rename) {
      const mapping = m.states.map((s, i) => `q${i} = ${s.name}`);
      m = { ...m, states: m.states.map((s, i) => ({ ...s, name: `q${i}` })) };
      desc += ` Estados renomeados: ${mapping.join('; ')}.`;
    }
    const p = newProject(name, m, { description: desc, tests: keepTests ? structuredClone(project.tests) : [] });
    st.openProject(p);
    st.setDialog(null);
    st.showToast(`"${name}" aberto como novo projeto. O projeto anterior continua salvo.`);
  };

  return (
    <Modal title="Linguagens regulares" onClose={close} wide>
      <div className="reg-layout">
        <nav className="reg-nav" aria-label="Ferramentas">
          {TOOLS.map((t) => (
            <button key={t.id} aria-current={tool === t.id ? 'page' : undefined} onClick={() => !running && setTool(t.id)} disabled={!!running && tool !== t.id}>
              <strong>{t.title}</strong>
              <span>{t.desc}</span>
              <small>{t.ref === 'complementar' ? 'algoritmo complementar' : `Sipser, ${t.ref}`}</small>
            </button>
          ))}
          <label className="field small-field">
            <span>Limite de estados</span>
            <input id="reg-max-states" type="number" min={10} max={200000} value={maxStates} onChange={(e) => setMaxStates(Math.max(10, Math.floor(Number(e.target.value) || 10)))} />
          </label>
        </nav>
        <section className="reg-main" aria-live="polite">
          <h3>
            {info.title} <span className="muted small">— {info.ref === 'complementar' ? 'algoritmo complementar' : `Sipser, ${info.ref}`}</span>
          </h3>

          {!currentFA && (
            <p className="callout warn">
              O projeto atual é {project.machine.kind === 'tm' ? 'uma' : 'um'} <strong>{project.machine.kind === 'tm' ? 'máquina de Turing' : 'autômato com pilha'}</strong>. Estas ferramentas trabalham com autômatos finitos e expressões regulares (linguagens regulares). Abra um AF, ou use "Outro projeto" / "Expressão regular" em Operações e Equivalência.
            </p>
          )}
          {needsCurrent && currentFA && (
            <p className="muted">
              Entrada: o projeto atual, <strong>{project.name}</strong> ({currentFA.kind === 'dfa' ? 'AFD' : 'AFN'}, {currentFA.states.length} estados, Σ = {`{${currentFA.alphabet.join(', ')}}`}).
              {!currentValid.valid && <span className="error-text"> A máquina tem erros de validação; corrija-os antes (veja o painel Validação).</span>}
            </p>
          )}

          {tool === 'toRegex' && (
            <div className="row wrap">
              <label className="check">
                <input type="checkbox" checked={simplify} onChange={(e) => setSimplify(e.target.checked)} /> Aplicar simplificações que preservam a linguagem
              </label>
              <label className="field inline">
                <span>Ordem de remoção</span>
                <select value={order} onChange={(e) => setOrder(e.target.value as 'heuristic' | 'listed')}>
                  <option value="heuristic">menos combinações primeiro</option>
                  <option value="listed">ordem dos estados</option>
                </select>
              </label>
            </div>
          )}

          {tool === 'regexToNfa' && (
            <>
              <RegexField id="reg-src" value={regex} onChange={setRegex} sigma={inferSigma ? null : sigmaText} />
              <div className="row wrap">
                <label className="field inline grow">
                  <span>Σ</span>
                  <input className="mono" value={sigmaText} disabled={inferSigma} onChange={(e) => setSigmaText(e.target.value)} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={inferSigma} onChange={(e) => setInferSigma(e.target.checked)} /> inferir Σ dos símbolos usados
                </label>
              </div>
            </>
          )}

          {(tool === 'ops' || tool === 'equivalence') && (
            <div className="operands">
              {tool === 'ops' && (
                <label className="field">
                  <span>Operação</span>
                  <select value={op} onChange={(e) => setOp(e.target.value as typeof op)}>
                    <option value="union">A ∪ B — união (Teorema 1.45)</option>
                    <option value="intersection">A ∩ B — interseção (produto, Teorema 1.25)</option>
                    <option value="difference">A − B — diferença (produto com complemento)</option>
                    <option value="concat">A ∘ B — concatenação (Teorema 1.47)</option>
                    <option value="star">A* — estrela (Teorema 1.49)</option>
                    <option value="complement">Ā — complemento em relação a Σ*</option>
                  </select>
                </label>
              )}
              <OperandPicker label="A" value={opA} onChange={setOpA} />
              {(tool === 'equivalence' || (op !== 'star' && op !== 'complement')) && <OperandPicker label="B" value={opB} onChange={setOpB} />}
              {tool === 'ops' && op === 'complement' && (
                <label className="field">
                  <span>Σ do complemento (deve conter o alfabeto de A)</span>
                  <input className="mono" value={complementSigma} onChange={(e) => setComplementSigma(e.target.value)} />
                  <small className="muted">O complemento depende de Σ: com Σ maior, entram também as cadeias com os símbolos novos.</small>
                </label>
              )}
            </div>
          )}

          <div className="row">
            {running ? (
              <button className="btn danger" onClick={() => running.cancel()}>
                <Icon name="stop" /> Cancelar
              </button>
            ) : (
              <button className="btn primary" onClick={execute} disabled={needsCurrent && (!currentFA || !currentValid.valid)}>
                <Icon name="play" /> Executar
              </button>
            )}
            {running && <span className="muted">Calculando em segundo plano…</span>}
          </div>

          {error && (
            <div className={`callout ${error.kind === 'limit' || error.kind === 'cancelled' ? 'warn' : 'error'}`} role="alert">
              <strong>{{ limit: 'Inconclusivo (limite de recursos)', cancelled: 'Interrompido', invalid: 'Entrada inválida', syntax: 'Erro de sintaxe', internal: 'Erro interno' }[error.kind]}:</strong> {error.message}
            </div>
          )}

          {result && <ResultView result={result} openAsProject={openAsProject} />}
        </section>
      </div>
    </Modal>
  );
}

function RegexField({ id, value, onChange, sigma }: { id: string; value: string; onChange: (v: string) => void; sigma: string | null }) {
  const preview = useMemo(() => {
    if (!value.trim()) return null;
    try {
      const a = sigma === null ? null : parseAlphabetText(sigma).symbols;
      const r = parseRegex(value, { alphabet: a });
      return { ok: true as const, text: fullyParenthesized(r.re) };
    } catch (e) {
      if (e instanceof RegexSyntaxError) return { ok: false as const, text: e.message, pos: e.position };
      return { ok: false as const, text: (e as Error).message, pos: 0 };
    }
  }, [value, sigma]);
  const insert = (t: string) => onChange(value + t);
  return (
    <div className="field">
      <span>
        <label htmlFor={id}>Expressão regular</label>
      </span>
      <input id={id} className="mono regex-input" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoComplete="off" />
      <div className="row wrap insert-row" role="group" aria-label="Inserir símbolo especial">
        {['ε', '∅', '∪', '*', '⁺', 'Σ', '(', ')', '<>'].map((t) => (
          <button key={t} type="button" className="btn small mono" onClick={() => insert(t === '<>' ? '<>' : t)} title={{ ε: 'palavra vazia', '∅': 'linguagem vazia', '∪': 'união (também |)', '*': 'estrela', '⁺': 'R⁺ = RR* (também ^+)', Σ: 'qualquer símbolo de Σ', '<>': 'símbolo de vários caracteres: <NOME>' }[t] ?? t}>
            {t}
          </button>
        ))}
      </div>
      {preview &&
        (preview.ok ? (
          <small className="muted">
            Leitura: <span className="mono">{preview.text}</span>
          </small>
        ) : (
          <small className="error-text" role="alert">
            {preview.text}
            {preview.pos !== undefined && (
              <span className="mono caret-line">
                {'\n'}
                {value}
                {'\n'}
                {' '.repeat(preview.pos)}^
              </span>
            )}
          </small>
        ))}
      <small className="muted">Precedência: estrela, depois concatenação, depois união. "+" sozinho não é aceito (use ∪ ou |; para R⁺ use ⁺ ou ^+).</small>
    </div>
  );
}

function OperandPicker({ label, value, onChange }: { label: string; value: OperandChoice; onChange: (v: OperandChoice) => void }) {
  const project = useApp((s) => s.project);
  const others = useMemo(() => projectStore.list().filter((p) => p.id !== project.id && (p.kind === 'dfa' || p.kind === 'nfa')), [project.id]);
  const id = `operand-${label}`;
  return (
    <fieldset className="operand">
      <legend>Operando {label}</legend>
      <div className="segmented small-seg" role="radiogroup" aria-label={`Origem do operando ${label}`}>
        <button role="radio" aria-checked={value.mode === 'current'} disabled={!isFA(project.machine)} onClick={() => onChange({ mode: 'current' })}>
          Projeto atual
        </button>
        <button role="radio" aria-checked={value.mode === 'project'} disabled={others.length === 0} onClick={() => others[0] && onChange({ mode: 'project', id: others[0].id })}>
          Outro projeto
        </button>
        <button role="radio" aria-checked={value.mode === 'regex'} onClick={() => onChange({ mode: 'regex', src: '', sigma: sigmaOf(project.machine).join(', ') })}>
          Expressão regular
        </button>
      </div>
      {value.mode === 'current' && (
        <p className="muted small">
          {project.name} ({{ dfa: 'AFD', nfa: 'AFN', pda: 'AP — não aceito aqui', tm: 'MT — não aceita aqui' }[project.machine.kind]}, Σ = {`{${sigmaOf(project.machine).join(', ')}}`})
        </p>
      )}
      {value.mode === 'project' && (
        <select aria-label={`Projeto do operando ${label}`} value={value.id} onChange={(e) => onChange({ mode: 'project', id: e.target.value })}>
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.kind === 'dfa' ? 'AFD' : 'AFN'})
            </option>
          ))}
        </select>
      )}
      {value.mode === 'regex' && (
        <>
          <RegexField id={`${id}-re`} value={value.src} onChange={(src) => onChange({ ...value, src })} sigma={value.sigma} />
          <label className="field inline">
            <span>Σ</span>
            <input className="mono" value={value.sigma} onChange={(e) => onChange({ ...value, sigma: e.target.value })} />
          </label>
        </>
      )}
    </fieldset>
  );
}

function Notes({ basis, notes }: { basis: string; notes: string[] }) {
  return (
    <div className="notes">
      <p className="basis">
        <Icon name="book" /> {basis}
      </p>
      <ul>
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

function ResultView({ result, openAsProject }: { result: Result; openAsProject: (m: FiniteAutomaton, name: string, desc: string, keepTests: boolean, rename: boolean) => void }) {
  const project = useApp((s) => s.project);
  const st = useApp.getState();
  const [showFull, setShowFull] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      st.showToast('Copiado.');
    } catch {
      st.showToast('O navegador bloqueou a área de transferência; selecione e copie o texto.', 'error');
    }
  };
  const OpenBtn = ({ m, name, desc, keep }: { m: FiniteAutomaton; name: string; desc: string; keep: boolean }) => <OpenAsProject m={m} name={name} desc={desc} keep={keep} open={openAsProject} />;

  switch (result.tool) {
    case 'nfaToDfa': {
      const d = result.data;
      return (
        <div className="result">
          <Notes basis={d.basis} notes={d.notes} />
          <div className="table-scroll">
            <table className="delta">
              <caption className="sr-only">Estados do AFD e subconjuntos do AFN</caption>
              <thead>
                <tr>
                  <th>Estado do AFD (= subconjunto do AFN)</th>
                  {d.table.columns.map((c) => (
                    <th key={c} className="mono">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.table.rows.map((r) => (
                  <tr key={r.name}>
                    <th scope="row" className="mono">
                      {r.initial ? '→' : ''}
                      {r.accepting ? '*' : ''}
                      {r.subset}
                    </th>
                    {r.targets.map((t, i) => (
                      <td key={i} className="mono">
                        {t}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <OpenBtn m={d.machine} name={`${project.name} — AFD`} desc={`AFD obtido de "${project.name}" pela construção dos subconjuntos (Sipser, Teorema 1.39). Cada estado é rotulado pelo conjunto de estados do AFN que representa.`} keep />
        </div>
      );
    }
    case 'minimize': {
      const d = result.data;
      return (
        <div className="result">
          <Notes basis={d.basis} notes={d.notes} />
          <h4>Partições</h4>
          <ol className="rounds">
            {d.rounds.map((r, i) => (
              <li key={i}>
                <span className="muted">Rodada {i}:</span>{' '}
                {r.map((b, j) => (
                  <span key={j} className="block mono" aria-label={`bloco ${j + 1}: ${b.join('; ')}`}>
                    {b.map((n, k) => (
                      <span key={k} className="member">
                        {n}
                      </span>
                    ))}
                  </span>
                ))}
              </li>
            ))}
          </ol>
          <OpenBtn m={d.machine} name={`${project.name} — mínimo`} desc={`AFD mínimo de "${project.name}" (${d.before} → ${d.after} estados), por refinamento de partição (algoritmo complementar).`} keep />
        </div>
      );
    }
    case 'regexToNfa': {
      const d = result.data;
      return (
        <div className="result">
          <Notes basis={d.basis} notes={d.notes} />
          <OpenBtn m={d.machine} name={`ER: ${result.src}`} desc={`AFN para a expressão regular ${d.parsed} sobre Σ = {${d.alphabet.join(', ')}}, pelo Lema 1.55.`} keep={false} />
        </div>
      );
    }
    case 'toRegex': {
      const d = result.data;
      const text = showFull ? d.full : d.regex;
      return (
        <div className="result">
          <div className="regex-out">
            <code className="mono">{text}</code>
            <div className="row">
              <button className="btn small" onClick={() => copy(text)}>
                <Icon name="copy" /> Copiar
              </button>
              <label className="check small">
                <input type="checkbox" checked={showFull} onChange={(e) => setShowFull(e.target.checked)} /> totalmente parentizada
              </label>
            </div>
          </div>
          <p className={`callout ${d.verified === 'equivalent' ? 'info' : 'warn'}`}>
            {d.verified === 'equivalent' ? '✓ ' : '! '}
            {d.verifyNote}
          </p>
          <Notes basis={d.basis} notes={d.notes} />
          <details>
            <summary>Passos de eliminação ({d.steps.length})</summary>
            <ol className="gnfa-steps">
              {d.steps.map((s, i) => (
                <li key={i}>
                  Remove <span className="mono">{s.removed}</span> (restam {s.remaining} estados):
                  <ul>
                    {s.changes.map((c, j) => (
                      <li key={j} className="mono">
                        {c.from} → {c.to}: {c.label}
                      </li>
                    ))}
                    {s.changesOmitted > 0 && <li className="muted">… e mais {s.changesOmitted} rótulos</li>}
                    {s.changes.length === 0 && <li className="muted">nenhum rótulo muda</li>}
                  </ul>
                </li>
              ))}
            </ol>
          </details>
        </div>
      );
    }
    case 'ops': {
      const d = result.data;
      return (
        <div className="result">
          <Notes basis={d.basis} notes={d.notes} />
          <OpenBtn m={d.machine} name={result.title} desc={`${result.title}. ${d.basis}.`} keep={false} />
        </div>
      );
    }
    case 'equivalence': {
      const d = result.data;
      const simulateIn = d.counterexample !== undefined && (result.aIsCurrent || result.bIsCurrent);
      return (
        <div className="result">
          {d.equivalent ? (
            <p className="verdict ok">✓ As linguagens são iguais (equivalência provada, não amostrada).</p>
          ) : (
            <div className="verdict bad">
              <p>✗ As linguagens são diferentes.</p>
              <p>
                Contraexemplo mínimo: <code className="mono cx">{d.counterexample}</code> é aceita por <strong>{d.acceptedBy}</strong> e rejeitada por <strong>{d.rejectedBy}</strong>.
              </p>
              {simulateIn && (
                <button
                  className="btn small"
                  onClick={() => {
                    st.setSimInput(d.counterexample === 'ε' ? '' : d.counterexample!);
                    st.setBottomTab('sim');
                    st.simStart();
                    st.setDialog(null);
                  }}
                >
                  <Icon name="play" /> Simular no projeto atual
                </button>
              )}
            </div>
          )}
          <Notes basis={d.basis} notes={[`Σ = {${d.alphabet.join(', ')}}; AFDs completos com ${d.sizes[0]} e ${d.sizes[1]} estados; ${d.explored} par(es) examinados.`, ...d.notes]} />
        </div>
      );
    }
  }
}

function OpenAsProject({ m, name, desc, keep, open }: { m: FiniteAutomaton; name: string; desc: string; keep: boolean; open: (m: FiniteAutomaton, name: string, desc: string, keepTests: boolean, rename: boolean) => void }) {
  const long = m.states.some((s) => [...s.name].length > 11);
  const [rename, setRename] = useState(long);
  return (
    <div className="open-row">
      <button className="btn primary" onClick={() => open(m, name, desc, keep, rename)}>
        Abrir como novo projeto ({m.kind === 'dfa' ? 'AFD' : 'AFN'}, {m.states.length} estados)
      </button>
      <label className="check small">
        <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} /> Renomear estados como q0, q1, … (a correspondência fica na descrição)
      </label>
      {keep && <small className="muted">Os testes do lote do projeto atual são copiados: a linguagem é a mesma.</small>}
    </div>
  );
}
