import { parseProjectFile, serializeProjects, type Project } from './schema';

/**
 * Salvamento local (localStorage). NÃO é sincronização em nuvem: os dados ficam
 * apenas neste navegador, neste dispositivo.
 * Recebe um `Storage`-like para ser testável sem navegador.
 */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const PREFIX = 'automata-lab:v1:';
const INDEX = `${PREFIX}index`;
const LAST = `${PREFIX}last`;
const projKey = (id: string) => `${PREFIX}project:${id}`;

export interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  kind: string;
}

export class ProjectStore {
  constructor(private kv: KV) {}

  list(): ProjectMeta[] {
    try {
      const raw = this.kv.getItem(INDEX);
      const arr = raw ? (JSON.parse(raw) as ProjectMeta[]) : [];
      return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
    } catch {
      return [];
    }
  }

  load(id: string): Project | null {
    try {
      const raw = this.kv.getItem(projKey(id));
      if (!raw) return null;
      const parsed = parseProjectFile(raw);
      if (!parsed.ok) return null;
      // parseProjectFile gera novo id; aqui preservamos o id armazenado.
      return { ...parsed.projects[0], id, updatedAt: (JSON.parse(raw).projects[0]?.updatedAt as string) ?? parsed.projects[0].updatedAt };
    } catch {
      return null;
    }
  }

  save(p: Project): { ok: true } | { ok: false; error: string } {
    try {
      this.kv.setItem(projKey(p.id), serializeProjects([p]));
      const meta: ProjectMeta = { id: p.id, name: p.name, description: p.description, updatedAt: p.updatedAt, kind: p.machine.kind };
      const list = this.list().filter((m) => m.id !== p.id);
      this.kv.setItem(INDEX, JSON.stringify([meta, ...list]));
      this.kv.setItem(LAST, p.id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `Não foi possível salvar localmente (${(e as Error).message}). O armazenamento do navegador pode estar cheio ou bloqueado.` };
    }
  }

  remove(id: string): void {
    try {
      this.kv.removeItem(projKey(id));
      this.kv.setItem(INDEX, JSON.stringify(this.list().filter((m) => m.id !== id)));
    } catch {
      /* ignorado */
    }
  }

  lastOpened(): string | null {
    try {
      return this.kv.getItem(LAST);
    } catch {
      return null;
    }
  }
}

export class MemoryKV implements KV {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
