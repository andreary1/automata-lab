import type { FAEdge, FAState, FiniteAutomaton } from '../fa/model';
import type { Machine } from '../machine';
import type { PDA, PDAEdge } from '../pda/model';
import type { BatchCase } from '../fa/batch';
import { symbolProblem } from '../fa/symbols';
import { newId } from '../ids';

/**
 * Formato de arquivo JSON do Automata Lab.
 * `schemaVersion` permite migrações futuras (PDA, MT). Ao importar, toda a
 * estrutura é validada; nada é aceito "no escuro".
 */
export const FILE_FORMAT = 'automata-lab';
/** v1: só autômatos finitos. v2: acrescenta AP (kind "pda") e limites de configurações/pilha. */
export const SCHEMA_VERSION = 2;

export interface ProjectSettings {
  /** AF: símbolos processados; AP: profundidade da busca em largura. */
  maxSteps: number;
  /** AP: configurações distintas exploradas. */
  maxConfigs: number;
  /** AP: altura máxima da pilha. */
  maxStack: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  machine: Machine;
  tests: BatchCase[];
  settings: ProjectSettings;
}

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  projects: Project[];
}

export const DEFAULT_SETTINGS: ProjectSettings = { maxSteps: 100_000, maxConfigs: 50_000, maxStack: 500 };

export function newProject(name: string, machine: Machine, extra: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return { id: newId('p'), name, description: '', createdAt: now, updatedAt: now, machine, tests: [], settings: { ...DEFAULT_SETTINGS }, ...extra };
}

export function serializeProjects(projects: Project[]): string {
  const file: ProjectFile = { format: FILE_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), projects };
  return JSON.stringify(file, null, 2);
}

export type ParseResult = { ok: true; projects: Project[]; warnings: string[] } | { ok: false; errors: string[] };

class SchemaError extends Error {}

function req(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new SchemaError(msg);
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseStates(raw: Record<string, unknown>, where: string): FAState[] {
  req(Array.isArray(raw.states), `${where}: "machine.states" deve ser uma lista.`);
  const states: FAState[] = (raw.states as unknown[]).map((s, i) => {
    req(isObj(s), `${where}: estado #${i + 1} inválido.`);
    req(isStr(s.id) && s.id.length > 0, `${where}: estado #${i + 1} sem "id".`);
    req(isStr(s.name), `${where}: estado #${i + 1} sem "name".`);
    req(isNum(s.x) && isNum(s.y), `${where}: estado "${s.name}" sem posição numérica (x, y).`);
    req(typeof s.accepting === 'boolean', `${where}: estado "${s.name}" sem "accepting" booleano.`);
    return { id: s.id, name: s.name, x: s.x, y: s.y, accepting: s.accepting };
  });
  req(new Set(states.map((s) => s.id)).size === states.length, `${where}: ids de estado repetidos.`);
  return states;
}

function parseSymbols(v: unknown, label: string, where: string): string[] {
  req(Array.isArray(v) && v.every(isStr), `${where}: ${label} deve ser uma lista de textos.`);
  const list = v as string[];
  for (const s of list) {
    const p = symbolProblem(s);
    req(!p, `${where}: símbolo inválido "${s}" em ${label}. ${p}`);
  }
  req(new Set(list).size === list.length, `${where}: ${label} tem símbolos repetidos.`);
  return list;
}

function parsePDA(raw: Record<string, unknown>, where: string): PDA {
  const inputAlphabet = parseSymbols(raw.inputAlphabet, 'Σ ("inputAlphabet")', where);
  const stackAlphabet = parseSymbols(raw.stackAlphabet, 'Γ ("stackAlphabet")', where);
  const states = parseStates(raw, where);
  const ids = new Set(states.map((s) => s.id));
  req(raw.initial === null || (isStr(raw.initial) && ids.has(raw.initial)), `${where}: "machine.initial" deve ser null ou o id de um estado existente.`);
  req(raw.acceptance === 'final' || raw.acceptance === 'empty', `${where}: "acceptance" deve ser "final" ou "empty".`);
  req(Array.isArray(raw.initialStack) && raw.initialStack.every(isStr), `${where}: "initialStack" deve ser uma lista de textos.`);
  req(Array.isArray(raw.edges), `${where}: "machine.edges" deve ser uma lista.`);
  const pairs = new Set<string>();
  const edges: PDAEdge[] = (raw.edges as unknown[]).map((e, i) => {
    req(isObj(e) && isStr(e.id), `${where}: seta #${i + 1} inválida.`);
    req(isStr(e.from) && ids.has(e.from) && isStr(e.to) && ids.has(e.to), `${where}: seta #${i + 1} liga estados inexistentes.`);
    const key = `${e.from}->${e.to}`;
    req(!pairs.has(key), `${where}: há duas setas entre o mesmo par de estados; elas devem ser uma só, com várias transições.`);
    pairs.add(key);
    req(Array.isArray(e.transitions), `${where}: seta #${i + 1} sem "transitions".`);
    const transitions = (e.transitions as unknown[]).map((t, j) => {
      req(isObj(t) && isStr(t.id), `${where}: transição #${j + 1} da seta #${i + 1} inválida.`);
      req(t.read === null || isStr(t.read), `${where}: "read" deve ser texto ou null (ε).`);
      req(t.pop === null || isStr(t.pop), `${where}: "pop" deve ser texto ou null (ε).`);
      req(Array.isArray(t.push) && t.push.every(isStr), `${where}: "push" deve ser lista de textos ([] = ε).`);
      return { id: t.id, read: t.read as string | null, pop: t.pop as string | null, push: [...(t.push as string[])] };
    });
    return { id: e.id, from: e.from, to: e.to, transitions };
  });
  return { kind: 'pda', inputAlphabet, stackAlphabet, states, edges, initial: (raw.initial as string | null) ?? null, acceptance: raw.acceptance, initialStack: [...(raw.initialStack as string[])] };
}

function parseMachine(raw: unknown, where: string, warnings: string[]): Machine {
  req(isObj(raw), `${where}: "machine" deve ser um objeto.`);
  if (raw.kind === 'pda') return parsePDA(raw, where);
  return parseFA(raw, where, warnings);
}

function parseFA(raw: Record<string, unknown>, where: string, warnings: string[]): FiniteAutomaton {
  req(raw.kind === 'dfa' || raw.kind === 'nfa', `${where}: "machine.kind" deve ser "dfa", "nfa" ou "pda" (recebido ${JSON.stringify(raw.kind)}).`);
  req(Array.isArray(raw.alphabet) && raw.alphabet.every(isStr), `${where}: "machine.alphabet" deve ser uma lista de textos.`);
  const alphabet = raw.alphabet as string[];
  for (const s of alphabet) {
    const p = symbolProblem(s);
    req(!p, `${where}: símbolo inválido "${s}" em Σ. ${p}`);
  }
  req(new Set(alphabet).size === alphabet.length, `${where}: Σ tem símbolos repetidos.`);
  req(Array.isArray(raw.states), `${where}: "machine.states" deve ser uma lista.`);
  const states: FAState[] = (raw.states as unknown[]).map((s, i) => {
    req(isObj(s), `${where}: estado #${i + 1} inválido.`);
    req(isStr(s.id) && s.id.length > 0, `${where}: estado #${i + 1} sem "id".`);
    req(isStr(s.name), `${where}: estado #${i + 1} sem "name".`);
    req(isNum(s.x) && isNum(s.y), `${where}: estado "${s.name}" sem posição numérica (x, y).`);
    req(typeof s.accepting === 'boolean', `${where}: estado "${s.name}" sem "accepting" booleano.`);
    return { id: s.id, name: s.name, x: s.x, y: s.y, accepting: s.accepting };
  });
  const ids = new Set(states.map((s) => s.id));
  req(ids.size === states.length, `${where}: ids de estado repetidos.`);
  req(raw.initial === null || (isStr(raw.initial) && ids.has(raw.initial)), `${where}: "machine.initial" deve ser null ou o id de um estado existente.`);
  req(Array.isArray(raw.edges), `${where}: "machine.edges" deve ser uma lista.`);
  const pairs = new Set<string>();
  const edges: FAEdge[] = (raw.edges as unknown[]).map((e, i) => {
    req(isObj(e), `${where}: transição #${i + 1} inválida.`);
    req(isStr(e.id), `${where}: transição #${i + 1} sem "id".`);
    req(isStr(e.from) && ids.has(e.from), `${where}: transição #${i + 1} com origem inexistente.`);
    req(isStr(e.to) && ids.has(e.to), `${where}: transição #${i + 1} com destino inexistente.`);
    req(Array.isArray(e.symbols) && e.symbols.every(isStr), `${where}: transição #${i + 1}: "symbols" deve ser lista de textos.`);
    req(typeof e.epsilon === 'boolean', `${where}: transição #${i + 1}: "epsilon" deve ser booleano.`);
    const key = `${e.from}->${e.to}`;
    req(!pairs.has(key), `${where}: há duas transições entre o mesmo par de estados; elas devem estar numa única aresta.`);
    pairs.add(key);
    const stray = (e.symbols as string[]).filter((s) => !alphabet.includes(s));
    if (stray.length) warnings.push(`${where}: transição #${i + 1} usa símbolo(s) fora de Σ (${stray.join(', ')}); isso aparecerá na validação.`);
    return { id: e.id, from: e.from, to: e.to, symbols: [...new Set(e.symbols as string[])], epsilon: e.epsilon };
  });
  return { kind: raw.kind, alphabet, states, edges, initial: (raw.initial as string | null) ?? null };
}

function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  // v1 → v2: nenhuma mudança estrutural nos AFs; limites novos recebem valores padrão.
  // Ponto de extensão: quando SCHEMA_VERSION subir, converter versões antigas aqui.
  return raw;
}

/** Valida e converte um arquivo importado. Novos ids de projeto são gerados (não sobrescreve nada). */
export function parseProjectFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`O arquivo não é um JSON válido: ${(e as Error).message}`] };
  }
  const warnings: string[] = [];
  try {
    req(isObj(data), 'O conteúdo deve ser um objeto JSON.');
    req(data.format === FILE_FORMAT, `Formato não reconhecido: esperado "format": "${FILE_FORMAT}".`);
    req(isNum(data.schemaVersion), 'Falta "schemaVersion".');
    req((data.schemaVersion as number) <= SCHEMA_VERSION, `O arquivo usa a versão de esquema ${data.schemaVersion}, mais nova que a suportada (${SCHEMA_VERSION}). Atualize o aplicativo.`);
    const d = migrate(data);
    req(Array.isArray(d.projects) && d.projects.length > 0, 'O arquivo não contém projetos.');
    const projects = (d.projects as unknown[]).map((p, i) => {
      const where = `Projeto #${i + 1}`;
      req(isObj(p), `${where}: deve ser um objeto.`);
      req(isStr(p.name), `${where}: falta "name".`);
      const machine = parseMachine(p.machine, `${where} ("${p.name}")`, warnings);
      const tests: BatchCase[] = Array.isArray(p.tests)
        ? (p.tests as unknown[]).filter(isObj).map((t) => ({
            input: isStr(t.input) ? t.input : '',
            expected: t.expected === 'accepted' || t.expected === 'rejected' ? t.expected : undefined,
          }))
        : [];
      const settings: ProjectSettings = { ...DEFAULT_SETTINGS };
      if (isObj(p.settings)) for (const k of ['maxSteps', 'maxConfigs', 'maxStack'] as const) if (isNum(p.settings[k]) && (p.settings[k] as number) > 0) settings[k] = Math.floor(p.settings[k] as number);
      const now = new Date().toISOString();
      return {
        id: newId('p'),
        name: p.name,
        description: isStr(p.description) ? p.description : '',
        createdAt: isStr(p.createdAt) ? p.createdAt : now,
        updatedAt: now,
        machine,
        tests,
        settings,
      } satisfies Project;
    });
    return { ok: true, projects, warnings };
  } catch (e) {
    if (e instanceof SchemaError) return { ok: false, errors: [e.message] };
    throw e;
  }
}
