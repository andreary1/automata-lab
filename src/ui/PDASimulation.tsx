import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunStatus } from '../core/fa/simulate';
import { isMultiCharAlphabet } from '../core/fa/symbols';
import type { PDA } from '../core/pda/model';
import { formatStack } from '../core/pda/model';
import { explainStep, stateName, type PDAConfig, type PDATrace } from '../core/pda/simulate';
import { simLength, useApp } from '../state/store';
import { SimControls, StatusBadge, usePlayback } from './BottomPanel';
import { HelpTip } from './HelpTip';

const MAX_LISTED = 80;

/** Pilha desenhada na vertical, topo em cima. */
function StackView({ stack, gamma }: { stack: string[]; gamma: string[] }) {
  return (
    <div className="stack-view" aria-label={`Pilha: ${formatStack(stack, gamma)} (topo à esquerda)`}>
      <div className="stack-cap">topo</div>
      {stack.length === 0 && <div className="stack-cell empty">vazia (ε)</div>}
      {stack.slice(0, 24).map((s, i) => (
        <div key={i} className={`stack-cell mono${i === 0 ? ' top' : ''}`}>
          {s}
        </div>
      ))}
      {stack.length > 24 && <div className="stack-cell more">… mais {stack.length - 24}</div>}
      <div className="stack-cap">fundo</div>
    </div>
  );
}

function Tape({ tokens, pos }: { tokens: string[]; pos: number }) {
  return (
    <div className="tape" aria-label={`Entrada: ${tokens.length ? tokens.join(' ') : 'ε'}; ${pos} símbolo(s) lido(s)`}>
      {tokens.length === 0 && <span className="tape-cell empty">ε</span>}
      {tokens.map((t, i) => (
        <span key={i} className={`tape-cell${i < pos ? ' read' : ''}${i === pos - 1 ? ' current' : ''}${i === pos ? ' next' : ''}`}>
          {t}
        </span>
      ))}
      {tokens.length > 0 && pos === tokens.length && <span className="tape-end">fim</span>}
    </div>
  );
}

function configText(m: PDA, c: PDAConfig, tokens: string[]): { state: string; rest: string; stack: string } {
  const multi = isMultiCharAlphabet(m.inputAlphabet);
  const rest = tokens.slice(c.pos);
  return { state: stateName(m, c.state), rest: rest.length ? rest.join(multi ? ' ' : '') : 'ε', stack: formatStack(c.stack, m.stackAlphabet) };
}

export function PDASimulationView() {
  const sim = useApp((s) => s.sim);
  const m = useApp((s) => s.project.machine) as PDA;
  const settings = useApp((s) => s.project.settings);
  const st = useApp.getState();
  const trace: PDATrace | null = sim.pdaTrace;
  const histRef = useRef<HTMLOListElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  usePlayback();
  const len = simLength(sim);
  const last = Math.max(0, len - 1);
  useEffect(() => setSelected(null), [sim.cursor, sim.pdaView, trace]);
  useEffect(() => {
    histRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  }, [sim.cursor]);

  let status: RunStatus | null = null;
  if (sim.computing) status = 'running';
  else if (sim.interrupted) status = 'interrupted';
  else if (trace) status = trace.status; // o resultado da busca já é conhecido; navegar pelos passos não o altera

  const pathView = sim.pdaView === 'path' && !!trace?.acceptingPath;
  const levelIds = trace && !pathView ? (trace.levels[sim.cursor]?.configs ?? []) : [];
  const current: PDAConfig | undefined = useMemo(() => {
    if (!trace) return undefined;
    if (pathView) return trace.configs[trace.acceptingPath![sim.cursor]];
    const id = selected ?? levelIds[0];
    return id !== undefined ? trace.configs[id] : undefined;
  }, [trace, pathView, sim.cursor, selected, levelIds]);
  const parent = current && current.parent !== null && trace ? trace.configs[current.parent] : undefined;

  return (
    <div className="sim">
      <SimControls multi={isMultiCharAlphabet(m.inputAlphabet)} hasTrace={!!trace} atEnd={!!trace && !sim.stale && sim.cursor >= last} canStop={status === 'running'} />

      {sim.stale && <p className="callout warn">A máquina foi alterada depois desta execução. Clique em Executar ou Avançar para recomeçar.</p>}
      {sim.computing && (
        <p className="callout info" role="status">
          Explorando configurações em largura (limites: {settings.maxConfigs} configurações, pilha até {settings.maxStack}, {settings.maxSteps} passos)… Use ■ para interromper.
        </p>
      )}
      {!trace && !sim.computing && !sim.interrupted && (
        <p className="muted">
          A simulação explora todas as escolhas não determinísticas em <strong>largura</strong>. Cada configuração é (estado, posição na entrada, pilha). Ao aceitar, você pode seguir o caminho de aceitação passo a passo ou ver todos os ramos de cada passo.
          <HelpTip topic="pdaConfig" />
        </p>
      )}
      {sim.interrupted && !trace && (
        <p className="callout warn">
          <StatusBadge status="interrupted" /> A busca foi interrompida antes de terminar. Nenhuma conclusão sobre aceitação foi tirada.
        </p>
      )}

      {trace && (
        <div className="sim-body">
          <div className="sim-main">
            <div className="sim-status-row row wrap">
              {status && <StatusBadge status={status} />}
              {trace.status !== 'invalid' && (
                <span className="muted small">
                  {trace.explored} configuração(ões) explorada(s), profundidade {trace.depth}. Exibindo {pathView ? 'o passo' : 'o passo da busca'} {sim.cursor} de {last}.
                </span>
              )}
            </div>
            {trace.status !== 'invalid' && !sim.stale && <p className={`final final-${trace.status}`}>{trace.reason}</p>}
            {trace.status === 'invalid' ? (
              <p className="callout error">{trace.reason}</p>
            ) : (
              <>
                {trace.acceptingPath && (
                  <div className="segmented small-seg" role="radiogroup" aria-label="O que percorrer">
                    <button role="radio" aria-checked={pathView} onClick={() => st.setPdaView('path')}>
                      Caminho de aceitação
                    </button>
                    <button role="radio" aria-checked={!pathView} onClick={() => st.setPdaView('levels')}>
                      Todos os ramos (busca em largura)
                    </button>
                  </div>
                )}
                {current && (
                  <div className="pda-config">
                    <div className="pda-config-main">
                      <p>
                        <strong>Configuração:</strong> estado <span className="mono">{stateName(m, current.state)}</span>, {current.pos} de {trace.tokens.length} símbolo(s) lido(s), pilha <span className="mono">{formatStack(current.stack, m.stackAlphabet)}</span>.
                        <HelpTip topic="pdaConfig" />
                      </p>
                      <Tape tokens={trace.tokens} pos={current.pos} />
                      <p>{parent ? explainStep(m, parent, current) : `Configuração inicial: estado ${stateName(m, current.state)}, pilha ${formatStack(current.stack, m.stackAlphabet)}${m.initialStack.length === 0 ? ' (vazia, como no livro)' : ''}.`}</p>
                    </div>
                    <StackView stack={current.stack} gamma={m.stackAlphabet} />
                  </div>
                )}
                {!pathView && (
                  <div className="level-configs">
                    <h4>
                      Passo {sim.cursor} da busca: {levelIds.length} configuração(ões) nova(s)
                      {levelIds.length === 0 && sim.cursor > 0 ? ' — nenhum ramo continua' : ''}
                    </h4>
                    <div className="table-scroll">
                      <table className="config-table">
                        <thead>
                          <tr>
                            <th>Estado</th>
                            <th>Entrada restante</th>
                            <th>Pilha (topo à esquerda)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {levelIds.slice(0, MAX_LISTED).map((id) => {
                            const c = trace.configs[id];
                            const t = configText(m, c, trace.tokens);
                            return (
                              <tr key={id} aria-selected={current?.id === id} onClick={() => setSelected(id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelected(id)}>
                                <td className="mono">{t.state}</td>
                                <td className="mono">{t.rest}</td>
                                <td className="mono">{t.stack}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {levelIds.length > MAX_LISTED && <p className="muted small">… e mais {levelIds.length - MAX_LISTED} configurações neste passo.</p>}
                    <p className="muted small">Configurações já vistas em passos anteriores não são repetidas (têm o mesmo futuro). No diagrama, o número no estado indica quantas configurações estão nele.</p>
                  </div>
                )}
              </>
            )}
          </div>
          {trace.status !== 'invalid' && (
            <div className="history">
              <h4>{pathView ? 'Caminho de aceitação' : 'Passos da busca'}</h4>
              <ol ref={histRef}>
                {pathView
                  ? trace.acceptingPath!.map((id, i) => {
                      const t = configText(m, trace.configs[id], trace.tokens);
                      return (
                        <li key={id}>
                          <button aria-current={i === sim.cursor ? 'step' : undefined} onClick={() => st.simJump(i)}>
                            <span className="h-i">{i}</span>
                            <span className="h-sym mono">{t.state}</span>
                            <span className="h-set mono">
                              {t.rest} | {t.stack}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  : trace.levels.map((lv, i) => (
                      <li key={i}>
                        <button aria-current={i === sim.cursor ? 'step' : undefined} onClick={() => st.simJump(i)}>
                          <span className="h-i">{i}</span>
                          <span className="h-sym">{lv.configs.length} conf.</span>
                          <span className="h-set mono">{[...new Set(lv.configs.map((id) => stateName(m, trace.configs[id].state)))].slice(0, 6).join(', ')}</span>
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
