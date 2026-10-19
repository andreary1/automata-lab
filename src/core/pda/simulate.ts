import type { RunStatus } from '../fa/simulate';
import { formatWord, tokenize } from '../fa/symbols';
import type { PDA, PDATransition } from './model';
import { formatStack, transitionLabel } from './model';
import { validatePDA } from './validate';

/**
 * Configuração de um AP: (estado, posição na entrada, conteúdo da pilha).
 * Estados iguais com pilhas diferentes são configurações DIFERENTES.
 * A pilha é um array com o TOPO no índice 0 (como a cadeia "at" do livro).
 */
export interface PDAConfig {
  id: number;
  state: string;
  pos: number;
  stack: string[];
  parent: number | null;
  /** Transição usada para chegar aqui a partir do pai. */
  via: { edgeId: string; transitionId: string } | null;
  depth: number;
}

export interface PDALevel {
  step: number;
  /** Ids das configurações criadas neste passo (todas, em ordem). */
  configs: number[];
}

export interface PDATrace {
  status: RunStatus;
  tokens: string[];
  reason: string;
  /** Todas as configurações registradas, indexadas pelo id. */
  configs: PDAConfig[];
  levels: PDALevel[];
  /** Ids do caminho inicial → configuração de aceitação (quando aceita). */
  acceptingPath?: number[];
  explored: number;
  /** Profundidade alcançada pela busca (passos). Na aceitação, comprimento do caminho. */
  depth: number;
  errorPosition?: number;
}

export interface PDALimits {
  /** Passos da busca em largura (profundidade máxima). */
  maxSteps: number;
  /** Configurações distintas exploradas. */
  maxConfigs: number;
  /** Altura máxima da pilha. */
  maxStack: number;
  shouldCancel?: () => boolean;
}

export const DEFAULT_PDA_LIMITS: PDALimits = { maxSteps: 2_000, maxConfigs: 50_000, maxStack: 500 };

export class PDACancelled extends Error {}

/**
 * Simulação não determinística por BUSCA EM LARGURA nas configurações (estratégia justa:
 * todo ramo avança um passo antes de qualquer ramo avançar dois). Configurações já vistas
 * não são exploradas de novo (mesmo futuro), o que garante término quando o espaço de
 * configurações alcançáveis é finito.
 *
 * Semântica do passo (Sipser, p. 116–117): de (q, i, at) com (r, b) ∈ δ(q, w_{i+1}, a) vai-se a
 * (r, i', bt), onde w_{i+1} é o próximo símbolo (i' = i + 1) ou ε (i' = i); a e b podem ser ε.
 * Aceitação (padrão do livro): existe uma configuração ALCANÇÁVEL com toda a entrada lida
 * e estado em F. Passar por F antes do fim da entrada não basta. Modo separado: pilha vazia.
 *
 * Resultados: aceita assim que um ramo aceita; rejeita apenas quando TODAS as configurações
 * alcançáveis foram exploradas sem aceitação e nenhum ramo foi cortado por limite; caso
 * contrário, inconclusiva (um limite não prova execução infinita nem rejeição).
 */
export function simulatePDA(m: PDA, input: string, limits: Partial<PDALimits> = {}, record = true): PDATrace {
  const L: PDALimits = { ...DEFAULT_PDA_LIMITS, ...limits };
  const report = validatePDA(m);
  if (!report.valid) {
    const e = report.issues.find((i) => i.severity === 'error')!;
    return { status: 'invalid', tokens: [], reason: `Máquina inválida: ${e.message} ${e.fix}`, configs: [], levels: [], explored: 0, depth: 0 };
  }
  const tk = tokenize(input, m.inputAlphabet);
  if (!tk.ok) return { status: 'invalid', tokens: tk.tokens, reason: `Entrada inválida: ${tk.error}`, configs: [], levels: [], explored: 0, depth: 0, errorPosition: tk.position };
  return runPDA(m, tk.tokens, L, record);
}

export function runPDA(m: PDA, tokens: string[], L: PDALimits, record: boolean): PDATrace {
  const n = tokens.length;
  const F = new Set(m.states.filter((s) => s.accepting).map((s) => s.id));
  const out = new Map<string, { edgeId: string; to: string; t: PDATransition }[]>();
  for (const e of m.edges) for (const t of e.transitions) out.set(e.from, [...(out.get(e.from) ?? []), { edgeId: e.id, to: e.to, t }]);
  const word = formatWord(tokens, m.inputAlphabet);
  const accepts = (c: PDAConfig) => c.pos === n && (m.acceptance === 'final' ? F.has(c.state) : c.stack.length === 0);
  const configs: PDAConfig[] = [];
  const keep = (c: PDAConfig) => {
    if (record) configs[c.id] = c;
  };
  const parents = new Map<number, number | null>(); // para reconstruir o caminho mesmo sem registrar tudo
  const all: PDAConfig[] = [];
  const visited = new Set<string>();
  const key = (s: string, p: number, st: string[]) => `${s}\u0001${p}\u0001${st.join('\u0002')}`;

  let nextId = 0;
  const start: PDAConfig = { id: nextId++, state: m.initial!, pos: 0, stack: [...m.initialStack], parent: null, via: null, depth: 0 };
  visited.add(key(start.state, 0, start.stack));
  keep(start);
  all.push(start);
  parents.set(start.id, null);
  const levels: PDALevel[] = [{ step: 0, configs: [start.id] }];
  const pathTo = (c: PDAConfig) => {
    const p: number[] = [];
    for (let cur: number | null = c.id; cur !== null; cur = parents.get(cur) ?? null) p.unshift(cur);
    return p;
  };
  const accepted = (c: PDAConfig): PDATrace => ({
    status: 'accepted',
    tokens,
    configs: record ? configs : pathTo(c).map((id) => all[id]),
    levels: record ? levels : [],
    acceptingPath: pathTo(c),
    explored: nextId,
    depth: c.depth,
    reason:
      m.acceptance === 'final'
        ? `Aceita: um ramo leu toda a entrada "${word}" e está no estado de aceitação ${stateName(m, c.state)} (pilha: ${formatStack(c.stack, m.stackAlphabet)}), após ${c.depth} passo(s). Basta um ramo aceitar.`
        : `Aceita (modo pilha vazia): um ramo leu toda a entrada "${word}" com a pilha vazia, após ${c.depth} passo(s).`,
  });
  if (accepts(start)) return accepted(start);

  let frontier = [start];
  let truncatedStack = false;
  let maxDepth = 0;
  let tick = 0;
  for (let step = 1; frontier.length > 0; step++) {
    if (step > L.maxSteps)
      return inconclusive(`Limite de ${L.maxSteps} passos atingido com ${frontier.length} configuração(ões) ainda pendente(s). Nenhuma conclusão sobre aceitação: aumente o limite.`);
    const next: PDAConfig[] = [];
    for (const c of frontier) {
      if (L.shouldCancel && (++tick & 127) === 0 && L.shouldCancel()) throw new PDACancelled();
      for (const { edgeId, to, t } of out.get(c.state) ?? []) {
        if (t.read !== null && (c.pos >= n || tokens[c.pos] !== t.read)) continue;
        if (t.pop !== null && c.stack[0] !== t.pop) continue;
        const rest = t.pop !== null ? c.stack.slice(1) : c.stack;
        const stack = t.push.length ? [...t.push, ...rest] : rest;
        if (stack.length > L.maxStack) {
          truncatedStack = true;
          continue;
        }
        const pos = t.read !== null ? c.pos + 1 : c.pos;
        const k = key(to, pos, stack);
        if (visited.has(k)) continue;
        visited.add(k);
        const nc: PDAConfig = { id: nextId++, state: to, pos, stack, parent: c.id, via: { edgeId, transitionId: t.id }, depth: step };
        maxDepth = step;
        keep(nc);
        all.push(nc);
        parents.set(nc.id, c.id);
        if (record) (levels[step] ??= { step, configs: [] }).configs.push(nc.id);
        if (accepts(nc)) return accepted(nc);
        if (nextId > L.maxConfigs)
          return inconclusive(`Limite de ${L.maxConfigs} configurações atingido sem aceitação, com ramos ainda pendentes. Isso não prova rejeição nem execução infinita: aumente o limite.`);
        next.push(nc);
      }
    }
    frontier = next;
  }
  if (truncatedStack)
    return inconclusive(`Nenhum ramo aceitou, mas algum ramo foi interrompido por ultrapassar a altura máxima de pilha (${L.maxStack}). Não dá para concluir rejeição: aumente o limite.`);
  return {
    status: 'rejected',
    tokens,
    configs: record ? configs : [],
    levels: record ? levels : [],
    explored: nextId,
    depth: maxDepth,
    reason:
      m.acceptance === 'final'
        ? `Rejeitada: todas as ${nextId} configurações alcançáveis foram exploradas e nenhuma tem toda a entrada "${word}" lida em estado de aceitação.`
        : `Rejeitada (modo pilha vazia): todas as ${nextId} configurações alcançáveis foram exploradas e nenhuma tem toda a entrada lida com a pilha vazia.`,
  };

  function inconclusive(reason: string): PDATrace {
    return { status: 'inconclusive', tokens, configs: record ? configs : [], levels: record ? levels : [], explored: nextId, depth: maxDepth, reason };
  }
}

export function stateName(m: PDA, id: string): string {
  return m.states.find((s) => s.id === id)?.name ?? '?';
}

/** Explicação de um passo: qual transição levou da configuração-pai à configuração c. */
export function explainStep(m: PDA, parent: PDAConfig, c: PDAConfig): string {
  const t = m.edges.find((e) => e.id === c.via?.edgeId)?.transitions.find((x) => x.id === c.via?.transitionId);
  if (!t) return '';
  const parts = [
    t.read === null ? 'não lê entrada (ε)' : `lê "${t.read}"`,
    t.pop === null ? 'não desempilha' : `desempilha "${t.pop}"`,
    t.push.length === 0 ? 'não empilha' : `empilha ${formatStack(t.push, m.stackAlphabet)}`,
  ];
  return `${stateName(m, parent.state)} → ${stateName(m, c.state)} por "${transitionLabel(t, m.stackAlphabet)}": ${parts.join(', ')}. Pilha: ${formatStack(parent.stack, m.stackAlphabet)} ⇒ ${formatStack(c.stack, m.stackAlphabet)}.`;
}
