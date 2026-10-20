import { TM_EXAMPLES } from '../tm/examples';
import type { TM } from '../tm/model';
import { simulateTM } from '../tm/simulate';
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { simulateFA } from '../fa/simulate';
import { DEFAULT_SETTINGS, newProject, parseProjectFile, serializeProjects } from './schema';
import type { FiniteAutomaton } from '../fa/model';
import { PDA_EXAMPLES } from '../pda/examples';
import { simulatePDA } from '../pda/simulate';
import type { PDA } from '../pda/model';
import { MemoryKV, ProjectStore } from './storage';

describe('importação/exportação JSON', () => {
  it('ida e volta preserva estados, transições, alfabeto, posições, testes e configurações', () => {
    const projects = EXAMPLES.map((e) => newProject(e.title, e.machine, { description: e.description, tests: e.tests, settings: { ...DEFAULT_SETTINGS, maxSteps: 1234 } }));
    const parsed = parseProjectFile(serializeProjects(projects));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    parsed.projects.forEach((p, i) => {
      expect(p.machine).toEqual(projects[i].machine);
      expect(p.tests).toEqual(projects[i].tests);
      expect(p.settings).toEqual({ ...DEFAULT_SETTINGS, maxSteps: 1234 });
      expect(p.name).toBe(projects[i].name);
      expect(p.description).toBe(projects[i].description);
      expect(p.id).not.toBe(projects[i].id); // não sobrescreve projetos existentes
      // comportamento idêntico
      for (const t of projects[i].tests) expect(simulateFA(p.machine as FiniteAutomaton, t.input).status).toBe(simulateFA(projects[i].machine as FiniteAutomaton, t.input).status);
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

describe('autômatos com pilha (esquema v2)', () => {
  it('ida e volta preserva Σ, Γ, transições, pilha inicial, modo de aceitação e limites', () => {
    const projects = PDA_EXAMPLES.map((e) => newProject(e.title, e.machine, { tests: e.tests, settings: { maxSteps: 77, maxConfigs: 999, maxStack: 42 } }));
    const text = serializeProjects(projects);
    expect(JSON.parse(text).schemaVersion).toBe(3);
    const parsed = parseProjectFile(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    parsed.projects.forEach((p, i) => {
      expect(p.machine).toEqual(projects[i].machine);
      expect(p.settings).toEqual({ maxSteps: 77, maxConfigs: 999, maxStack: 42 });
      for (const t of projects[i].tests.filter((x) => x.expected))
        expect(simulatePDA(p.machine as PDA, t.input).status).toBe(simulatePDA(projects[i].machine as PDA, t.input).status);
    });
  });
  it('arquivos da versão 1 (só AF, sem limites novos) continuam sendo importados', () => {
    const v1 = JSON.parse(serializeProjects([newProject('antigo', EXAMPLES[0].machine)]));
    v1.schemaVersion = 1;
    v1.projects[0].settings = { maxSteps: 50 };
    const parsed = parseProjectFile(JSON.stringify(v1));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.projects[0].settings).toEqual({ ...DEFAULT_SETTINGS, maxSteps: 50 });
  });
  it('AP malformado é recusado com mensagem', () => {
    const bad = JSON.parse(serializeProjects([newProject('x', PDA_EXAMPLES[0].machine)]));
    bad.projects[0].machine.edges[0].transitions[0].push = 'ab';
    expect(parseProjectFile(JSON.stringify(bad))).toMatchObject({ ok: false, errors: [expect.stringContaining('push')] });
    const bad2 = JSON.parse(serializeProjects([newProject('x', PDA_EXAMPLES[0].machine)]));
    bad2.projects[0].machine.acceptance = 'talvez';
    expect(parseProjectFile(JSON.stringify(bad2)).ok).toBe(false);
  });
});

describe('máquinas de Turing (esquema v3)', () => {
  it('ida e volta preserva Σ, extras de Γ, transições e estados de parada', () => {
    const projects = TM_EXAMPLES.map((e) => newProject(e.title, e.machine, { tests: e.tests }));
    const parsed = parseProjectFile(serializeProjects(projects));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    parsed.projects.forEach((p, i) => {
      expect(p.machine).toEqual(projects[i].machine);
      for (const t of projects[i].tests) expect(simulateTM(p.machine as TM, t.input, { maxSteps: 500 }).status).toBe(simulateTM(projects[i].machine as TM, t.input, { maxSteps: 500 }).status);
    });
  });
  it('arquivos v2 continuam sendo importados', () => {
    const v2 = JSON.parse(serializeProjects([newProject('ap', PDA_EXAMPLES[0].machine)]));
    v2.schemaVersion = 2;
    expect(parseProjectFile(JSON.stringify(v2)).ok).toBe(true);
  });
  it('MT malformada é recusada com mensagem', () => {
    const bad = JSON.parse(serializeProjects([newProject('x', TM_EXAMPLES[0].machine)]));
    bad.projects[0].machine.edges[0].transitions[0].move = 'S';
    expect(parseProjectFile(JSON.stringify(bad))).toMatchObject({ ok: false, errors: [expect.stringContaining('move')] });
    const bad2 = JSON.parse(serializeProjects([newProject('x', TM_EXAMPLES[0].machine)]));
    bad2.projects[0].machine.acceptState = 'nao-existe';
    expect(parseProjectFile(JSON.stringify(bad2)).ok).toBe(false);
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
