import { useEffect, useRef, useState } from 'react';
import { emptyAutomaton } from '../core/fa/model';
import { newProject, type Project } from '../core/persistence/schema';
import { askConfirm, projectStore, useApp } from '../state/store';
import { HELP } from './HelpTip';
import { Icon } from './icons';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header>
          <h2>{title}</h2>
          <button className="btn ghost icon-only" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ProjectsDialog() {
  const current = useApp((s) => s.project);
  const st = useApp.getState();
  const [list, setList] = useState(() => projectStore.list());
  const close = () => st.setDialog(null);
  const refresh = () => setList(projectStore.list());
  useEffect(() => {
    projectStore.save(current);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = (kind: 'dfa' | 'nfa') => {
    st.openProject(newProject(kind === 'dfa' ? 'Novo AFD' : 'Novo AFN', emptyAutomaton(kind)));
    close();
  };

  return (
    <Modal title="Projetos" onClose={close} wide>
      <p className="callout info">
        Os projetos ficam salvos <strong>apenas neste navegador</strong> (armazenamento local). Isso não é sincronização em nuvem: limpar os dados do navegador apaga os projetos. Use "Exportar → Todos os projetos" para guardar uma cópia.
      </p>
      <div className="row">
        <button className="btn primary" onClick={() => create('dfa')}>
          <Icon name="plus" /> Novo AFD
        </button>
        <button className="btn" onClick={() => create('nfa')}>
          <Icon name="plus" /> Novo AFN
        </button>
      </div>
      <ul className="project-list">
        {list.map((p) => (
          <li key={p.id} className={p.id === current.id ? 'current' : ''}>
            <div>
              <strong>{p.name || '(sem nome)'}</strong> <span className={`kind-badge ${p.kind}`}>{p.kind === 'dfa' ? 'AFD' : 'AFN'}</span>
              {p.id === current.id && <span className="tag">aberto</span>}
              {p.description && <p className="muted small">{p.description}</p>}
              <p className="muted small">Atualizado em {new Date(p.updatedAt).toLocaleString('pt-BR')}</p>
            </div>
            <div className="row">
              <button
                className="btn small"
                disabled={p.id === current.id}
                onClick={() => {
                  const loaded = projectStore.load(p.id);
                  if (!loaded) return st.showToast('Não foi possível ler este projeto (dados corrompidos?).', 'error');
                  st.openProject(loaded);
                  close();
                }}
              >
                Abrir
              </button>
              <button
                className="btn small"
                onClick={() => {
                  const src = p.id === current.id ? current : projectStore.load(p.id);
                  if (!src) return;
                  projectStore.save(newProject(`${src.name} (cópia)`, structuredClone(src.machine), { description: src.description, tests: structuredClone(src.tests), settings: { ...src.settings } }));
                  refresh();
                }}
              >
                <Icon name="copy" /> Duplicar
              </button>
              <button
                className="btn small danger"
                disabled={p.id === current.id}
                title={p.id === current.id ? 'Abra outro projeto antes de excluir este.' : undefined}
                onClick={async () => {
                  if (!(await askConfirm(`Excluir o projeto "${p.name}" deste navegador? Esta ação não pode ser desfeita.`, 'Excluir'))) return;
                  projectStore.remove(p.id);
                  refresh();
                }}
              >
                <Icon name="trash" /> Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function ImportDialog({ pending, warnings, onClose }: { pending: Project[]; warnings: string[]; onClose: () => void }) {
  const st = useApp.getState();
  return (
    <Modal title="Importar projetos" onClose={onClose}>
      <p>
        O arquivo contém {pending.length} projeto(s) válido(s). Eles serão adicionados como <strong>novos projetos</strong>; nada existente será sobrescrito.
      </p>
      <ul className="import-list">
        {pending.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong> — {p.machine.kind === 'dfa' ? 'AFD' : 'AFN'}, {p.machine.states.length} estado(s), Σ = {`{${p.machine.alphabet.join(', ')}}`}
          </li>
        ))}
      </ul>
      {warnings.length > 0 && (
        <div className="callout warn">
          <strong>Avisos:</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="row end">
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn primary"
          onClick={() => {
            pending.forEach((p) => projectStore.save(p));
            st.openProject(pending[0]);
            st.showToast(`${pending.length} projeto(s) importado(s). Aberto: "${pending[0].name}".`);
            onClose();
          }}
        >
          Importar e abrir o primeiro
        </button>
      </div>
    </Modal>
  );
}

export function HelpDialog() {
  const st = useApp.getState();
  return (
    <Modal title="Ajuda" onClose={() => st.setDialog(null)} wide>
      <div className="help-grid">
        <section>
          <h3>Atalhos</h3>
          <dl className="keys">
            <dt>V / S / T</dt>
            <dd>Ferramentas Selecionar, Estado, Transição</dd>
            <dt>Delete</dt>
            <dd>Excluir seleção</dd>
            <dt>Ctrl+Z / Ctrl+Shift+Z</dt>
            <dd>Desfazer / refazer (Ctrl+Y também refaz)</dd>
            <dt>Setas</dt>
            <dd>Mover estados selecionados (Shift: passo maior)</dd>
            <dt>F</dt>
            <dd>Ajustar à tela</dd>
            <dt>Duplo clique</dt>
            <dd>No vazio: novo estado. Num estado: renomear</dd>
            <dt>Roda do mouse</dt>
            <dd>Zoom; arrastar o fundo desloca a vista</dd>
            <dt>Alt + arrastar</dt>
            <dd>Mover sem alinhar à grade</dd>
            <dt>Esc</dt>
            <dd>Cancelar transição em andamento / limpar seleção</dd>
            <dt>Tab / Enter</dt>
            <dd>Navegar pelos estados no canvas e selecioná-los</dd>
          </dl>
        </section>
        <section>
          <h3>Conceitos</h3>
          {Object.entries(HELP).map(([k, h]) => (
            <details key={k}>
              <summary>{h.title}</summary>
              <p>{h.body}</p>
            </details>
          ))}
        </section>
        <section>
          <h3>Convenções do aplicativo</h3>
          <ul>
            <li>AFD e AFN seguem as Definições 1.5 e 1.37 do Sipser. Um AFD com transições ausentes é aceito como rascunho; na simulação, a ausência equivale a um poço implícito (a cadeia é rejeitada). Use "Completar com estado poço" para torná-lo completo.</li>
            <li>Um AFN aceita se, após consumir toda a entrada, algum estado ativo pertence a F. O simulador acompanha o conjunto de estados ativos (todos os ramos) e aplica o fecho-ε no início e após cada símbolo.</li>
            <li>Resultados possíveis: Aceita, Rejeitada, Execução em andamento, Interrompida pelo usuário, Inconclusiva (limite de passos) e Máquina ou entrada inválida.</li>
            <li>Testes em lote verificam amostras; não provam que a máquina reconhece uma linguagem.</li>
            <li>"Linguagens regulares" (barra superior) converte e combina máquinas e expressões regulares. Os resultados sempre abrem como projetos novos. A equivalência é decidida de forma exata (Teorema 4.5) e, quando as linguagens diferem, mostra o menor contraexemplo.</li>
            <li>Expressões regulares: ∪ ou | para união, justaposição para concatenação, * para estrela, ⁺ para RR*, ε, ∅, Σ, e &lt;NOME&gt; para símbolos de vários caracteres. "+" sozinho não é aceito.</li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}

export function ConfirmDialog() {
  const req = useApp((s) => s.confirmReq);
  if (!req) return null;
  return (
    <Modal title="Confirmar" onClose={() => req.resolve(false)}>
      <p>{req.message}</p>
      <div className="row end">
        <button className="btn" onClick={() => req.resolve(false)}>
          Cancelar
        </button>
        <button className="btn primary" onClick={() => req.resolve(true)}>
          {req.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
