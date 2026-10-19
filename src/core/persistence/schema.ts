import type { FAEdge, FAState, FiniteAutomaton } from '../fa/model';
import type { BatchCase } from '../fa/batch';
import { symbolProblem } from '../fa/symbols';
import { newId } from '../ids';

/**
 * Formato de arquivo JSON do Automata Lab.
 * `schemaVersion` permite migrações futuras (PDA, MT). Ao importar, toda a
 * estrutura é validada; nada é aceito "no escuro".
 */
export const FILE_FORMAT = 'automata-lab';
export const SCHEMA_VERSION = 1;

export interface ProjectSettings {
  maxSteps: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  machine: FiniteAutomaton;
  tests: BatchCase[];
  settings: ProjectSettings;
}

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  projects: Project[];
}

export const DEFAULT_SETTINGS: ProjectSettings = { maxSteps: 100_000 };

export function newProject(name: string, machine: FiniteAutomaton, extra: Partial<Project> = {}): Project {
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

function parseMachine(raw: unknown, where: string, warnings: string[]): FiniteAutomaton {
  req(isObj(raw), `${where}: "machine" deve ser um objeto.`);
  req(raw.kind === 'dfa' || raw.kind === 'nfa', `${where}: "machine.kind" deve ser "dfa" ou "nfa" (recebido ${JSON.stringify(raw.kind)}).`);
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
      if (isObj(p.settings) && isNum(p.settings.maxSteps) && p.settings.maxSteps > 0) settings.maxSteps = Math.floor(p.settings.maxSteps);
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
