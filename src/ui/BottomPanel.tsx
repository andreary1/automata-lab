import { useEffect, useMemo, useRef, useState } from 'react';
import { EXAMPLES } from '../core/examples';
import type { BatchCase } from '../core/fa/batch';
import { formatStateSet } from '../core/fa/model';
import { STATUS_LABEL, type RunStatus } from '../core/fa/simulate';
import { isMultiCharAlphabet } from '../core/fa/symbols';
import { cancelBatch, startBatch } from '../state/batchRunner';
import { useApp } from '../state/store';
import { HelpTip } from './HelpTip';
import { Icon } from './icons';

export function BottomPanel() {
  const tab = useApp((s) => s.bottomTab);
  const setTab = useApp((s) => s.setBottomTab);
  return (
    <section className="panel bottom" aria-label="Simulação e testes">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'sim'} onClick={() => setTab('sim')}>
          Simulação
        </button>
        <button role="tab" aria-selected={tab === 'batch'} onClick={() => setTab('batch')}>
          Teste em lote
        </button>
      </div>
      <div className="panel-scroll">{tab === 'sim' ? <SimulationView /> : <BatchView />}</div>
    </section>
  );
}

export function StatusBadge({ status, extra }: { status: RunStatus; extra?: string }) {
  const icon: Record<RunStatus, string> = { accepted: '✓', rejected: '✗', running: '…', interrupted: '■', inconclusive: '?', invalid: '⚠' };
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true">{icon[status]}</span> {STATUS_LABEL[status]}
      {extra ? ` ${extra}` : ''}
    </span>
  );
}

function SimulationView() {
  const sim = useApp((s) => s.sim);
  const m = useApp((s) => s.project.machine);
  const st = useApp.getState();
  const histRef = useRef<HTMLOListElement>(null);
  const trace = sim.trace;
  const last = trace ? trace.steps.length - 1 : 0;
  const step = trace?.steps[sim.cursor];

  useEffect(() => {
    if (!sim.playing) return;
    const t = setInterval(() => {
      const s = useApp.getState();
      const tr = s.sim.trace;
      if (!tr || s.sim.cursor >= tr.steps.length - 1) s.simPause();
      else useApp.setState((x) => ({ sim: { ...x.sim, cursor: x.sim.cursor + 1, playing: x.sim.cursor + 1 < tr.steps.length - 1 } }));
    }, 1000 / sim.speed);
    return () => clearInterval(t);
  }, [sim.playing, sim.speed]);

  useEffect(() => {
    histRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  }, [sim.cursor]);

  let status: RunStatus | null = null;
  if (trace) {
    if (trace.status === 'invalid') status = 'invalid';
    else if (sim.interrupted) status = 'interrupted';
    else if (sim.cursor < last) status = 'running';
    else status = trace.status;
  }
  const multi = isMultiCharAlphabet(m.alphabet);
  const tokens = trace?.tokens ?? [];
  const consumed = step?.consumed ?? 0;

  return (
    <div className="sim">
      <div className="sim-controls">
        <div className="field grow">
          <span>
            <label htmlFor="sim-input">Cadeia de entrada</label> <HelpTip topic="tokens" />
          </span>
          <input
            id="sim-input"
            className="mono"
            value={sim.input}
            placeholder={multi ? 'símbolos separados por espaço; vazio = ε' : 'ex.: 0101 — deixe vazio para ε'}
            onChange={(e) => st.setSimInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                st.simStart();
              }
            }}
            aria-describedby="sim-input-hint"
          />
          <small id="sim-input-hint" className="muted">
            {sim.input.trim() === '' ? 'Entrada atual: ε (palavra vazia).' : multi ? 'Σ tem símbolos de vários caracteres: separe por espaço.' : 'Lida caractere a caractere.'} Enter prepara a execução passo a passo.
          </small>
        </div>
        <div className="btn-group" role="group" aria-label="Controles da simulação">
          {sim.playing ? (
            <button className="btn primary" onClick={st.simPause} title="Pausar">
              <Icon name="pause" /> Pausar
            </button>
          ) : (
            <button className="btn primary" onClick={st.simPlay} title="Executar automaticamente">
              <Icon name="play" /> Executar
            </button>
          )}
          <button className="btn" onClick={() => st.simStep(-1)} disabled={!trace || sim.cursor === 0} title="Voltar um passo" aria-label="Voltar um passo">
            <Icon name="stepb" />
          </button>
          <button className="btn" onClick={() => st.simStep(1)} disabled={!!trace && !sim.stale && sim.cursor >= last} title="Avançar um passo" aria-label="Avançar um passo">
            <Icon name="stepf" />
          </button>
          <button className="btn" onClick={st.simStop} disabled={!trace || status !== 'running'} title="Interromper" aria-label="Interromper execução">
            <Icon name="stop" />
          </button>
          <button className="btn" onClick={st.simReset} disabled={!trace} title="Reiniciar" aria-label="Reiniciar">
            <Icon name="reset" />
          </button>
        </div>
        <label className="field speed">
          <span>Velocidade: {sim.speed} passo(s)/s</span>
          <input type="range" min={0.5} max={10} step={0.5} value={sim.speed} onChange={(e) => st.setSpeed(Number(e.target.value))} />
        </label>
      </div>

      {sim.stale && <p className="callout warn">A máquina foi alterada depois desta execução. Os destaques foram ocultados; clique em Executar ou Avançar para recomeçar.</p>}

      {!trace && <p className="muted">Digite uma cadeia e use Executar (automático) ou Avançar (passo a passo). O diagrama destaca os estados ativos e as transições usadas.</p>}

      {trace && (
        <div className="sim-body">
          <div className="sim-main">
            <div className="sim-status-row">
              {status && <StatusBadge status={status} extra={status === 'running' ? `— passo ${sim.cursor} de ${last}${sim.playing ? '' : ' (pausada)'}` : undefined} />}
            </div>
            {trace.status !== 'invalid' && (
              <div className="tape" aria-label={`Entrada: ${tokens.length === 0 ? 'ε' : tokens.join(' ')}`}>
                {tokens.length === 0 && <span className="tape-cell empty">ε</span>}
                {tokens.map((t, i) => (
                  <span key={i} className={`tape-cell${i < consumed ? ' read' : ''}${i === consumed - 1 ? ' current' : ''}${i === consumed && !sim.stale ? ' next' : ''}`} title={`símbolo ${i + 1}`}>
                    {t}
                    {i === consumed - 1 && <span className="sr-only"> (lido neste passo)</span>}
                  </span>
                ))}
                {tokens.length > 0 && consumed === tokens.length && <span className="tape-end">fim</span>}
              </div>
            )}
            {trace.status === 'invalid' ? (
              <p className="callout error">{trace.reason}</p>
            ) : (
              step && (
                <div className="explain">
                  <p>
                    <strong>Configuração:</strong> estados ativos <span className="mono">{formatStateSet(m, step.active)}</span>, {consumed} de {tokens.length} símbolo(s) lido(s).
                    <HelpTip topic="configuration" />
                  </p>
                  <p>{step.explanation}</p>
                  {sim.cursor === last && !sim.interrupted && <p className={`final final-${trace.status}`}>{trace.reason}</p>}
                  {sim.interrupted && <p className="final">Execução interrompida pelo usuário no passo {sim.cursor}. Nenhuma conclusão sobre aceitação foi tirada.</p>}
                </div>
              )
            )}
          </div>
          {trace.steps.length > 0 && (
            <div className="history">
              <h4>Histórico de configurações</h4>
              <ol ref={histRef}>
                {trace.steps.map((s, i) => (
                  <li key={i}>
                    <button aria-current={i === sim.cursor ? 'step' : undefined} onClick={() => st.simJump(i)}>
                      <span className="h-i">{i}</span>
                      <span className="h-sym mono">{s.symbol === null ? 'início' : `"${s.symbol}"`}</span>
                      <span className="h-set mono">{formatStateSet(m, s.active)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BatchView() {
  const project = useApp((s) => s.project);
  const batch = useApp((s) => s.batch);
  const setTests = useApp((s) => s.setTests);
  const setMaxSteps = useApp((s) => s.setMaxSteps);
  const [bulk, setBulk] = useState('');
  const tests = project.tests;
  const results = batch.results;

  const update = (i: number, patch: Partial<BatchCase>) => setTests(tests.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  const addBulk = () => {
    const lines = bulk.split('\n').filter((l) => l.length > 0);
    if (!lines.length) return;
    setTests([...tests, ...lines.map((l) => ({ input: l.trim() === 'ε' ? '' : l.trim() }))]);
    setBulk('');
  };
  const summary = useMemo(() => {
    if (!results) return null;
    const c = (s: RunStatus) => results.filter((r) => r.status === s).length;
    const mism = results.filter((r) => r.matches === false).length;
    return { acc: c('accepted'), rej: c('rejected'), other: results.length - c('accepted') - c('rejected'), mism };
  }, [results]);
  const exampleForProject = EXAMPLES.find((e) => JSON.stringify(e.machine) === JSON.stringify(project.machine));

  return (
    <div className="batch">
      <div className="batch-toolbar">
        {batch.running ? (
          <button className="btn danger" onClick={cancelBatch}>
            <Icon name="stop" /> Cancelar ({batch.progress[0]}/{batch.progress[1]})
          </button>
        ) : (
          <button className="btn primary" onClick={startBatch} disabled={tests.length === 0}>
            <Icon name="play" /> Executar lote ({tests.length})
          </button>
        )}
        <label className="field inline">
          <span>Limite de passos por cadeia</span>
          <input type="number" min={1} max={10_000_000} value={project.settings.maxSteps} onChange={(e) => setMaxSteps(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        </label>
        {exampleForProject && (
          <button className="btn small" onClick={() => setTests(structuredClone(exampleForProject.tests))}>
            Restaurar testes do exemplo
          </button>
        )}
        <button className="btn small" onClick={() => setTests([])} disabled={tests.length === 0}>
          Limpar lista
        </button>
        {summary && (
          <span className="muted">
            {summary.acc} aceita(s), {summary.rej} rejeitada(s){summary.other ? `, ${summary.other} outra(s)` : ''}
            {summary.mism ? <strong className="error-text"> · {summary.mism} diferente(s) do esperado</strong> : ''}
          </span>
        )}
      </div>
      {batch.stale && <p className="callout warn">A máquina ou a lista mudou desde a última execução do lote. Execute novamente para atualizar.</p>}
      <div className="batch-grid">
        <div className="table-scroll">
          <table className="batch-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cadeia</th>
                <th>Esperado</th>
                <th>Resultado</th>
                <th>Passos</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t, i) => {
                const r = results && !batch.stale ? results[i] : undefined;
                return (
                  <tr key={i} className={r?.matches === false ? 'mismatch' : ''}>
                    <td>{i + 1}</td>
                    <td>
                      <input className="mono" value={t.input} placeholder="ε" aria-label={`Cadeia ${i + 1}`} onChange={(e) => update(i, { input: e.target.value })} />
                    </td>
                    <td>
                      <select value={t.expected ?? ''} aria-label={`Esperado para a cadeia ${i + 1}`} onChange={(e) => update(i, { expected: (e.target.value || undefined) as BatchCase['expected'] })}>
                        <option value="">—</option>
                        <option value="accepted">Aceita</option>
                        <option value="rejected">Rejeitada</option>
                      </select>
                    </td>
                    <td title={r?.message}>
                      {r ? (
                        <>
                          <StatusBadge status={r.status} />
                          {r.matches === false && <span className="error-text"> ≠ esperado</span>}
                          {r.matches === true && <span className="ok-text"> = esperado</span>}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{r ? r.steps : ''}</td>
                    <td className="row-actions">
                      <button
                        className="btn small ghost"
                        title="Simular passo a passo"
                        onClick={() => {
                          const s = useApp.getState();
                          s.setSimInput(t.input);
                          s.setBottomTab('sim');
                          s.simStart();
                        }}
                      >
                        <Icon name="play" />
                        <span className="sr-only">Simular passo a passo</span>
                      </button>
                      <button className="btn small ghost" title="Remover" onClick={() => setTests(tests.filter((_, k) => k !== i))}>
                        <Icon name="x" />
                        <span className="sr-only">Remover</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tests.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Nenhuma cadeia. Adicione ao lado (uma por linha).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bulk">
          <label className="field">
            <span>Adicionar cadeias (uma por linha; "ε" = palavra vazia)</span>
            <textarea className="mono" rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'01\n1101\nε'} />
          </label>
          <button className="btn small" onClick={addBulk}>
            Adicionar à lista
          </button>
          <p className="muted small">O lote roda em segundo plano e pode ser cancelado. Passar nos testes não prova que a máquina reconhece a linguagem desejada: é uma verificação por amostras.</p>
        </div>
      </div>
    </div>
  );
}
