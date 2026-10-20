import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL } from '../core/machine';
import { serializeProjects } from '../core/persistence/schema';
import { projectStore, useApp } from '../state/store';
import { diagramSVGString, downloadBlob, downloadText, safeFileName, svgToPng } from './exportDiagram';
import { Icon } from './icons';

export function TopBar({ svgRef, onImport }: { svgRef: React.RefObject<SVGSVGElement>; onImport: () => void }) {
  const project = useApp((s) => s.project);
  const saveStatus = useApp((s) => s.saveStatus);
  const theme = useApp((s) => s.theme);
  const canUndo = useApp((s) => s.past.length > 0);
  const canRedo = useApp((s) => s.future.length > 0);
  const panels = useApp((s) => s.panels);
  const st = useApp.getState();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  const base = safeFileName(project.name);
  const exportJSON = () => downloadText(`${base}.automata.json`, serializeProjects([project]), 'application/json');
  const exportAll = () => {
    const all = projectStore
      .list()
      .map((m) => (m.id === project.id ? project : projectStore.load(m.id)))
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (!all.some((p) => p.id === project.id)) all.unshift(project);
    downloadText(`automata-lab-projetos.json`, serializeProjects(all), 'application/json');
  };
  const exportSVG = () => svgRef.current && downloadText(`${base}.svg`, diagramSVGString(svgRef.current, project.machine), 'image/svg+xml');
  const exportPNG = async () => {
    if (!svgRef.current) return;
    try {
      downloadBlob(`${base}.png`, await svgToPng(diagramSVGString(svgRef.current, project.machine)));
    } catch (e) {
      st.showToast((e as Error).message, 'error');
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      st.showToast(`${what} copiado para a área de transferência.`);
    } catch {
      st.showToast(`Não foi possível copiar ${what}: o navegador bloqueou a área de transferência.`, 'error');
    }
  };

  const saveText =
    saveStatus.kind === 'pending'
      ? 'Salvando…'
      : saveStatus.kind === 'error'
        ? 'Erro ao salvar'
        : saveStatus.at
          ? `Salvo neste navegador às ${new Date(saveStatus.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
          : 'Salvo neste navegador';

  return (
    <header className="topbar">
      <div className="brand" aria-label="Automata Lab">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span>Automata Lab</span>
      </div>
      <button className="btn ghost icon-only mobile-only" onClick={() => st.togglePanel('left')} aria-label="Ferramentas e exemplos" aria-pressed={panels.left}>
        <Icon name="panelL" />
      </button>
      <div className="project-name">
        <input value={project.name} onChange={(e) => st.setProjectMeta({ name: e.target.value })} aria-label="Nome do projeto" />
        <span className={`kind-badge ${project.machine.kind}`}>{KIND_LABEL[project.machine.kind]}</span>
      </div>
      <span className={`save-status ${saveStatus.kind}`} title={saveStatus.message ?? 'Salvamento automático local. Não é sincronização em nuvem: os dados ficam só neste navegador e dispositivo. Exporte em JSON para guardar uma cópia.'} role="status">
        {saveText}
      </span>
      <div className="spacer" />
      <div className="btn-group">
        <button className="btn ghost icon-only" onClick={st.undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
          <Icon name="undo" />
        </button>
        <button className="btn ghost icon-only" onClick={st.redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">
          <Icon name="redo" />
        </button>
      </div>
      <button className="btn" onClick={() => st.setDialog('regular')} aria-label="Linguagens regulares" title="AFN → AFD, minimização, expressões regulares, operações e equivalência">
        <Icon name="regular" /> <span className="hide-sm">Linguagens regulares</span>
      </button>
      <button className="btn" onClick={() => st.setDialog('projects')} aria-label="Projetos" title="Projetos">
        <Icon name="folder" /> <span className="hide-sm">Projetos</span>
      </button>
      <button className="btn" onClick={onImport} aria-label="Importar" title="Importar JSON">
        <Icon name="upload" /> <span className="hide-sm">Importar</span>
      </button>
      <div className="menu-wrap" ref={menuRef}>
        <button className="btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label="Exportar" title="Exportar">
          <Icon name="download" /> <span className="hide-sm">Exportar</span>
        </button>
        {menu && (
          <div className="menu" role="menu">
            {[
              ['Projeto atual (JSON)', exportJSON],
              ['Todos os projetos (JSON)', exportAll],
              ['Diagrama (SVG)', exportSVG],
              ['Diagrama (PNG)', exportPNG],
              ['Copiar JSON do projeto', () => copy(serializeProjects([project]), 'JSON do projeto')],
              ['Copiar SVG do diagrama', () => svgRef.current && copy(diagramSVGString(svgRef.current, project.machine), 'SVG do diagrama')],
            ].map(([label, fn]) => (
              <button
                key={label as string}
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  (fn as () => void)();
                }}
              >
                {label as string}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="btn ghost icon-only" onClick={() => st.setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} title="Alternar tema">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <button className="btn ghost icon-only" onClick={() => st.setDialog('help')} aria-label="Ajuda e atalhos" title="Ajuda (?)">
        <Icon name="help" />
      </button>
    </header>
  );
}
