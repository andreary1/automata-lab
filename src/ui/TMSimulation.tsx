import { useEffect, useMemo, useRef } from 'react';
import type { RunStatus } from '../core/fa/simulate';
import { isMultiCharAlphabet } from '../core/fa/symbols';
import { BLANK, type TM } from '../core/tm/model';
import { configAt, explainTMStep, formatConfig, stateName, type TMTrace } from '../core/tm/simulate';
import { simLength, useApp } from '../state/store';
import { SimControls, StatusBadge, usePlayback } from './BottomPanel';
import { HelpTip } from './HelpTip';

/** Quantas células mostrar na janela da fita (a fita é "infinita" à direita). */
const WINDOW = 31;
/** Histórico: configurações listadas em volta da atual. */
const HIST_RADIUS = 60;

function TapeView({ tape, head, state, written, maxHead }: { tape: string[]; head: number; state: string; written: number | null; maxHead: number }) {
  // janela centrada no cabeçote, sem passar da célula 0; sempre inclui ao menos um branco depois do conteúdo
  const contentEnd = Math.max(tape.length, maxHead + 1, head + 1) + 1;
  const start = Math.max(0, Math.min(head - Math.floor(WINDOW / 2), contentEnd - WINDOW));
  const end = Math.max(start + Math.min(WINDOW, contentEnd), head + 1);
  const cells = Array.from({ length: end - start }, (_, i) => start + i);
  const shown = tape.slice(0, Math.max(tape.length, head + 1)).map((c) => c ?? BLANK);
  return (
    <div className="tm-tape-wrap">
      <div className="tm-tape" role="img" aria-label={`Fita: ${shown.join(' ') || BLANK}; cabeçote na célula ${head + 1}, estado ${state}`}>
        {start > 0 && <span className="tm-edge-note">… {start} célula(s)</span>}
        {cells.map((i) => {
          const sym = i < tape.length ? tape[i] : BLANK;
          const isHead = i === head;
          return (
            <span key={i} className={`tm-cell mono${isHead ? ' head' : ''}${sym === BLANK ? ' blank' : ''}${written === i ? ' written' : ''}`} title={`célula ${i + 1}`}>
              {isHead && (
                <span className="tm-head" aria-hidden="true">
                  <span className="tm-head-state">{state}</span>
                  <span className="tm-head-arrow">▼</span>
                </span>
              )}
              {sym}
              <span className="tm-index" aria-hidden="true">
                {i + 1}
              </span>
            </span>
          );
        })}
        <span className="tm-edge-note">… ⊔ ⊔</span>
      </div>
      <p className="muted small">
        A fita começa na célula 1 (borda esquerda) e é infinita à direita. ▼ marca o cabeçote; a célula com borda pontilhada foi escrita no último passo.
      </p>
    </div>
  );
}

export function TMSimulationView() {
  const sim = useApp((s) => s.sim);
  const m = useApp((s) => s.project.machine) as TM;
  const settings = useApp((s) => s.project.settings);
  const st = useApp.getState();
  const trace: TMTrace | null = sim.tmTrace;
  const histRef = useRef<HTMLOListElement>(null);
  usePlayback();
  const len = simLength(sim);
  const last = Math.max(0, len - 1);
  const k = Math.min(sim.cursor, last);
  useEffect(() => {
    histRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  }, [sim.cursor]);

  const cfg = useMemo(() => (trace && trace.status !== 'invalid' ? configAt(trace, k) : null), [trace, k]);
  const prevStep = trace && k > 0 ? trace.steps[k - 1] : null;

  let status: RunStatus | null = null;
  if (sim.computing) status = 'running';
  else if (sim.interrupted && !trace) status = 'interrupted';
  else if (trace) status = trace.status;

  const histFrom = Math.max(0, k - HIST_RADIUS);
  const histTo = Math.min(last, k + HIST_RADIUS);
  const histConfigs = useMemo(() => {
    if (!trace || trace.status === 'invalid') return [];
    // reconstrói incrementalmente a partir de histFrom (O(k + janela))
    const out: { i: number; text: string }[] = [];
    let c = configAt(trace, histFrom);
    for (let i = histFrom; i <= histTo; i++) {
      out.push({ i, text: formatConfig(m, c) });
      const s = trace.steps[i];
      if (!s) break;
      const tape = [...c.tape];
      while (tape.length <= s.head) tape.push(BLANK);
      tape[s.head] = s.write;
      c = { state: s.to, head: s.newHead, tape };
    }
    return out;
  }, [trace, m, histFrom, histTo]);

  return (
    <div className="sim">
      <SimControls multi={isMultiCharAlphabet(m.inputAlphabet)} hasTrace={!!trace} atEnd={!!trace && !sim.stale && sim.cursor >= last} canStop={status === 'running'} />

      {sim.stale && <p className="callout warn">A máquina ou a entrada mudou depois desta execução. Clique em Executar ou Avançar para recomeçar.</p>}
      {sim.computing && (
        <p className="callout info" role="status">
          Executando a máquina (limite: {settings.maxSteps.toLocaleString('pt-BR')} passos)… Use ■ para interromper.
        </p>
      )}
      {!trace && !sim.computing && !sim.interrupted && (
        <p className="muted">
          A máquina é executada até parar ou até o limite de passos; depois você navega pelas configurações para frente e para trás. A fita, o cabeçote e o estado aparecem abaixo, e o diagrama destaca o estado atual e a transição usada.
          <HelpTip topic="tmTape" />
        </p>
      )}
      {sim.interrupted && !trace && (
        <p className="callout warn">
          <StatusBadge status="interrupted" /> A execução foi interrompida antes de terminar. Nenhuma conclusão foi tirada.
        </p>
      )}

      {trace && (
        <div className="sim-body">
          <div className="sim-main">
            <div className="sim-status-row row wrap">
              {status && <StatusBadge status={status} />}
              {trace.status !== 'invalid' && (
                <span className="muted small">
                  {trace.stepCount.toLocaleString('pt-BR')} passo(s) executado(s). Exibindo a configuração {k.toLocaleString('pt-BR')} de {last.toLocaleString('pt-BR')}.
                </span>
              )}
            </div>
            {trace.status === 'invalid' ? (
              <p className="callout error">{trace.reason}</p>
            ) : (
              <>
                {!sim.stale && (
                  <div className={`final final-${trace.status}`}>
                    <p>{trace.reason}</p>
                    {trace.status === 'loop' && (
                      <div className="row wrap">
                        <button className="btn small" onClick={() => st.simJump(trace.loopFrom!)}>
                          Ver configuração {trace.loopFrom}
                        </button>
                        <button className="btn small" onClick={() => st.simJump(trace.loopAt!)}>
                          Ver configuração {trace.loopAt}
                        </button>
                      </div>
                    )}
                    {(trace.status === 'inconclusive' || trace.status === 'loop') && <HelpTip topic="tmHalt" />}
                  </div>
                )}
                {trace.recordTruncated && (
                  <p className="callout info">
                    Para economizar memória, só os primeiros {trace.steps.length.toLocaleString('pt-BR')} passos foram guardados para navegação; a execução continuou até o passo {trace.stepCount.toLocaleString('pt-BR')}. Fita final (sem brancos à direita): <span className="mono">{trace.finalTape.join(isMultiCharAlphabet(m.inputAlphabet) ? ' ' : '') || BLANK}</span>.
                  </p>
                )}
                {cfg && (
                  <>
                    <TapeView tape={cfg.tape} head={cfg.head} state={stateName(m, cfg.state)} written={prevStep ? prevStep.head : null} maxHead={trace.maxHead} />
                    <p>
                      <strong>Configuração {k}:</strong> <span className="mono tm-config">{formatConfig(m, cfg)}</span> <HelpTip topic="tmConfig" />
                    </p>
                    <p>{prevStep ? explainTMStep(m, prevStep) : `Configuração inicial: estado ${stateName(m, cfg.state)}, entrada nas células mais à esquerda, cabeçote na célula 1${trace.tokens.length === 0 ? ' (sobre um branco: a entrada é ε)' : ''}.`}</p>
                    {k === last && trace.halt === 'implicit-reject' && (
                      <p className="callout info">Próximo passo: não há transição para ({stateName(m, cfg.state)}, {cfg.head < cfg.tape.length ? cfg.tape[cfg.head] : BLANK}); a máquina vai para q_rejeita (p. 152).</p>
                    )}
                  </>
                )}
                {last > 1 && (
                  <label className="field tm-scrub">
                    <span>Ir para a configuração</span>
                    <input type="range" min={0} max={last} value={k} onChange={(e) => st.simJump(Number(e.target.value))} aria-valuetext={`configuração ${k} de ${last}`} />
                    <span className="row">
                      <button className="btn small" onClick={() => st.simJump(0)} disabled={k === 0}>
                        Início
                      </button>
                      <button className="btn small" onClick={() => st.simJump(last)} disabled={k === last}>
                        Fim
                      </button>
                    </span>
                  </label>
                )}
              </>
            )}
          </div>
          {trace.status !== 'invalid' && (
            <div className="history">
              <h4>Configurações (u q v)</h4>
              <ol ref={histRef}>
                {histFrom > 0 && <li className="muted small">… {histFrom} anterior(es)</li>}
                {histConfigs.map(({ i, text }) => (
                  <li key={i}>
                    <button aria-current={i === k ? 'step' : undefined} onClick={() => st.simJump(i)}>
                      <span className="h-i">{i}</span>
                      <span className="h-set mono">{text}</span>
                    </button>
                  </li>
                ))}
                {histTo < last && <li className="muted small">… mais {last - histTo}</li>}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
