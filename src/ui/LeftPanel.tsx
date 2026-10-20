import { EXAMPLES } from '../core/examples';
import { KIND_LABEL, type Machine } from '../core/machine';
import { PDA_EXAMPLES } from '../core/pda/examples';
import { TM_EXAMPLES } from '../core/tm/examples';
import type { BatchCase } from '../core/fa/batch';
import { autoLayout } from '../core/fa/layout';
import { newProject } from '../core/persistence/schema';
import { useApp, type Tool } from '../state/store';
import { Icon } from './icons';
import { animateStatesTo, zoomAround } from './camera';

const TOOLS: { id: Tool; label: string; key: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'Selecionar', key: 'V', icon: 'cursor', hint: 'Clique para selecionar, arraste estados para mover, arraste o fundo para deslocar a vista. Shift+clique seleciona vários.' },
  { id: 'state', label: 'Estado', key: 'S', icon: 'circle', hint: 'Clique no canvas para criar um estado.' },
  { id: 'edge', label: 'Transição', key: 'T', icon: 'arrow', hint: 'Arraste de um estado a outro (ou clique na origem e depois no destino).' },
];

export function LeftPanel() {
  const tool = useApp((s) => s.tool);
  const st = useApp.getState();
  const view = useApp((s) => s.view);

  const zoom = (f: number) => {
    const el = document.querySelector('.canvas') as SVGSVGElement | null;
    zoomAround(f, (el?.clientWidth ?? 800) / 2, (el?.clientHeight ?? 600) / 2);
  };

  return (
    <aside className="panel left" aria-label="Ferramentas e exemplos">
      <div className="panel-scroll">
        <section className="card">
          <h3>Ferramentas</h3>
          <div className="tools" role="radiogroup" aria-label="Ferramenta">
            {TOOLS.map((t) => (
              <button key={t.id} role="radio" aria-checked={tool === t.id} className="tool" onClick={() => st.setTool(t.id)} title={t.hint}>
                <Icon name={t.icon} size={18} />
                <span>{t.label}</span>
                <kbd>{t.key}</kbd>
              </button>
            ))}
          </div>
          <p className="muted small">{TOOLS.find((t) => t.id === tool)?.hint}</p>
        </section>
        <section className="card">
          <h3>Vista</h3>
          <div className="row wrap">
            <button className="btn small" onClick={() => zoom(1.2)} aria-label="Aproximar">
              <Icon name="plus" />
            </button>
            <button className="btn small" onClick={() => zoom(1 / 1.2)} aria-label="Afastar">
              <Icon name="minus" />
            </button>
            <span className="muted small zoom-level">{Math.round(view.k * 100)}%</span>
            <button className="btn small" onClick={st.requestFit} title="Ajustar à tela (F)">
              <Icon name="fit" /> Ajustar
            </button>
            <button
              className="btn small"
              title="Organizar automaticamente (pode ser desfeito)"
              onClick={() => {
                // Os estados viajam até o novo lugar (uma única entrada no desfazer); depois a câmera enquadra.
                animateStatesTo(autoLayout(st.project.machine), 0.45);
                setTimeout(() => st.requestFit(), 180);
              }}
            >
              <Icon name="layout" /> Organizar
            </button>
          </div>
        </section>
        <section className="card">
          <h3>
            <Icon name="book" /> Exemplos
          </h3>
          <p className="muted small">Abrir um exemplo cria um novo projeto; o atual continua salvo.</p>
          <h4 className="ex-group">Autômatos finitos</h4>
          <ExampleList items={EXAMPLES} />
          <h4 className="ex-group">Autômatos com pilha</h4>
          <ExampleList items={PDA_EXAMPLES} />
          <h4 className="ex-group">Máquinas de Turing</h4>
          <ExampleList items={TM_EXAMPLES} />
        </section>
      </div>
    </aside>
  );
}

interface ExampleItem {
  key: string;
  title: string;
  language: string;
  description: string;
  source?: string;
  machine: Machine;
  tests: BatchCase[];
}

function ExampleList({ items }: { items: ExampleItem[] }) {
  const st = useApp.getState();
  return (
    <ul className="examples">
      {items.map((e) => (
        <li key={e.key}>
          <button
            className="example"
            onClick={() => {
              const p = newProject(e.title, structuredClone(e.machine), {
                description: `${e.language}. ${e.description}${e.source ? ` Fonte: ${e.source}.` : ''}`,
                tests: structuredClone(e.tests),
              });
              st.openProject(p);
              st.togglePanel('left', window.innerWidth > 900);
              st.showToast(`Exemplo "${e.title}" aberto como novo projeto.`);
            }}
          >
            <span className="ex-title">
              {e.title} <span className={`kind-badge ${e.machine.kind}`}>{KIND_LABEL[e.machine.kind]}</span>
            </span>
            <span className="ex-lang mono">{e.language}</span>
            {e.source && <span className="ex-src">📖 {e.source}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
