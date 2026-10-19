import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { simulateFA } from '../fa/simulate';
import { newProject, parseProjectFile, serializeProjects } from './schema';
import { MemoryKV, ProjectStore } from './storage';

describe('importação/exportação JSON', () => {
  it('ida e volta preserva estados, transições, alfabeto, posições, testes e configurações', () => {
    const projects = EXAMPLES.map((e) => newProject(e.title, e.machine, { description: e.description, tests: e.tests, settings: { maxSteps: 1234 } }));
    const parsed = parseProjectFile(serializeProjects(projects));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    parsed.projects.forEach((p, i) => {
      expect(p.machine).toEqual(projects[i].machine);
      expect(p.tests).toEqual(projects[i].tests);
      expect(p.settings).toEqual({ maxSteps: 1234 });
      expect(p.name).toBe(projects[i].name);
      expect(p.description).toBe(projects[i].description);
      expect(p.id).not.toBe(projects[i].id); // não sobrescreve projetos existentes
      // comportamento idêntico
      for (const t of projects[i].tests) expect(simulateFA(p.machine, t.input).status).toBe(simulateFA(projects[i].machine, t.input).status);
    });
  });

  it('rejeita JSON malformado e formatos desconhecidos com mensagens claras', () => {
    expect(parseProjectFile('{oops')).toMatchObject({ ok: false });
    expect(parseProjectFile('{"format":"x"}')).toMatchObject({ ok: false, errors: [expect.stringContaining('Formato')] });
    expect(parseProjectFile('{"format":"automata-lab","schemaVersion":99,"projects":[]}')).toMatchObject({ ok: false, errors: [expect.stringContaining('versão')] });
  });

  it('rejeita máquina estruturalmente quebrada', () => {
    const p = newProject('x', structuredClone(EXAMPLES[0].machine));
    const bad = JSON.parse(serializeProjects([p]));
    bad.projects[0].machine.edges[0].to = 'nao-existe';
    expect(parseProjectFile(JSON.stringify(bad))).toMatchObject({ ok: false, errors: [expect.stringContaining('destino inexistente')] });
    const bad2 = JSON.parse(serializeProjects([p]));
    bad2.projects[0].machine.alphabet = ['0', 'ε'];
    expect(parseProjectFile(JSON.stringify(bad2)).ok).toBe(false);
    const bad3 = JSON.parse(serializeProjects([p]));
    bad3.projects[0].machine.initial = 'zzz';
    expect(parseProjectFile(JSON.stringify(bad3)).ok).toBe(false);
  });

  it('aceita rascunho (sem estado inicial, transição vazia)', () => {
    const m = structuredClone(EXAMPLES[0].machine);
    m.initial = null;
    m.edges[0].symbols = [];
    const parsed = parseProjectFile(serializeProjects([newProject('rascunho', m)]));
    expect(parsed.ok).toBe(true);
  });
});

describe('armazenamento local', () => {
  it('salva, lista, carrega e remove múltiplos projetos', () => {
    const store = new ProjectStore(new MemoryKV());
    const a = newProject('A', EXAMPLES[0].machine, { description: 'primeiro' });
    const b = newProject('B', EXAMPLES[3].machine);
    store.save(a);
    store.save({ ...b, updatedAt: '2999-01-01T00:00:00.000Z' });
    expect(store.list().map((p) => p.name)).toEqual(['B', 'A']);
    const loaded = store.load(a.id)!;
    expect(loaded.id).toBe(a.id);
    expect(loaded.machine).toEqual(a.machine);
    expect(loaded.description).toBe('primeiro');
    expect(store.lastOpened()).toBe(b.id);
    store.remove(a.id);
    expect(store.list().map((p) => p.name)).toEqual(['B']);
    expect(store.load(a.id)).toBeNull();
  });
  it('falha de escrita é reportada, não lançada', () => {
    const store = new ProjectStore({ getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} });
    expect(store.save(newProject('x', EXAMPLES[0].machine))).toMatchObject({ ok: false });
  });
});
