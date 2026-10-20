import type { RunStatus } from '../fa/simulate';
import { formatWord, tokenize } from '../fa/symbols';
import { BLANK, MOVE_LABEL, tapeAlphabet, tmTransitionLabel, type TM, type TMMove, type TMTransition } from './model';
import { validateTM } from './validate';

/**
 * Simulação determinística de uma MT de uma fita (Sipser, Def. 3.3 e p. 146–148).
 *
 * A execução guarda um registro compacto: para cada passo, a transição usada e a célula
 * escrita. A configuração k é reconstruída a partir da fita inicial aplicando as escritas dos
 * passos 0..k−1 (tapeAt), o que permite navegar para frente e para trás sem guardar a fita
 * inteira em cada passo.
 *
 * Resultados possíveis:
 *  - accepted: entrou em q_aceita;
 *  - rejected: entrou em q_rejeita, ou não há transição para (estado, símbolo) — q_rejeita
 *    implícito (p. 152);
 *  - loop: uma configuração COMPLETA (estado, posição do cabeçote, conteúdo da fita) se repetiu.
 *    Como a máquina é determinística, ela repetirá o mesmo ciclo para sempre: isso é uma prova
 *    de que não para nesta entrada. A detecção só cobre esse caso particular;
 *  - inconclusive: o limite de passos foi atingido sem parada. Isso NÃO prova que a máquina
 *    entra em laço: não existe procedimento geral que decida isso (Teorema 4.11, p. 182).
 */
export interface TMStep {
  /** Estado antes e depois do passo. */
  from: string;
  to: string;
  /** Cabeçote antes e depois do passo. */
  head: number;
  newHead: number;
  read: string;
  write: string;
  move: TMMove;
  edgeId: string;
  transitionId: string;
}

export interface TMTrace {
  status: RunStatus;
  tokens: string[];
  reason: string;
  /** Fita no início (a entrada nas células mais à esquerda). */
  initialTape: string[];
  initialState: string;
  /** steps[k] leva da configuração k à configuração k+1. Vazio quando não registrado. */
  steps: TMStep[];
  /** Quantidade total de passos executados (mesmo se não registrados). */
  stepCount: number;
  /** O registro para navegação guardou só os primeiros RECORD_CAP passos. */
  recordTruncated?: boolean;
  /** Como a máquina parou (quando parou). */
  halt?: 'accept' | 'reject' | 'implicit-reject';
  /** Em laço provado: a configuração `loopAt` é igual à configuração `loopFrom`. */
  loopFrom?: number;
  loopAt?: number;
  /** Maior posição já visitada pelo cabeçote (para desenhar a fita). */
  maxHead: number;
  /** Fita final (sem brancos à direita). */
  finalTape: string[];
  errorPosition?: number;
}

export interface TMLimits {
  maxSteps: number;
  shouldCancel?: () => boolean;
}

export const DEFAULT_TM_LIMITS: TMLimits = { maxSteps: 100_000 };

export class TMCancelled extends Error {}

/** Configurações completas guardadas para detectar repetição (orçamento em caracteres). */
const LOOP_BUDGET = 4_000_000;
const LOOP_MAX_TAPE = 2_000;
/** Passos guardados para navegação (memória); a execução continua além disso. */
export const RECORD_CAP = 200_000;

export function simulateTM(m: TM, input: string, limits: Partial<TMLimits> = {}, record = true): TMTrace {
  const L: TMLimits = { ...DEFAULT_TM_LIMITS, ...limits };
  const report = validateTM(m);
  const empty = { tokens: [] as string[], initialTape: [], initialState: m.initial ?? '', steps: [], stepCount: 0, maxHead: 0, finalTape: [] };
  if (!report.valid) {
    const e = report.issues.find((i) => i.severity === 'error')!;
    return { ...empty, status: 'invalid', reason: `Máquina inválida: ${e.message} ${e.fix}` };
  }
  const tk = tokenize(input, m.inputAlphabet);
  if (!tk.ok) return { ...empty, tokens: tk.tokens, status: 'invalid', reason: `Entrada inválida: ${tk.error}`, errorPosition: tk.position };
  return runTM(m, tk.tokens, L, record);
}

export function runTM(m: TM, tokens: string[], L: TMLimits, record: boolean): TMTrace {
  const delta = new Map<string, { edgeId: string; to: string; t: TMTransition }>();
  for (const e of m.edges) for (const t of e.transitions) delta.set(`${e.from}\u0001${t.read}`, { edgeId: e.id, to: e.to, t });
  const name = (id: string) => stateName(m, id);
  const word = formatWord(tokens, m.inputAlphabet) || 'ε';
  const tape: string[] = [...tokens];
  const steps: TMStep[] = [];
  let state = m.initial!;
  let head = 0;
  let maxHead = 0;
  let count = 0;
  let lastNonBlank = tape.length - 1;
  const seen = new Map<string, number>();
  let budget = LOOP_BUDGET;

  const base = (): Omit<TMTrace, 'status' | 'reason'> => {
    while (tape.length && tape[tape.length - 1] === BLANK) tape.pop();
    return { tokens, initialTape: [...tokens], initialState: m.initial!, steps, stepCount: count, maxHead, finalTape: [...tape], ...(record && count > steps.length ? { recordTruncated: true } : {}) };
  };

  for (;;) {
    if (state === m.acceptState) return { ...base(), status: 'accepted', halt: 'accept', reason: `Aceita: a máquina entrou em ${name(state)} após ${count} passo(s) com a entrada "${word}".` };
    if (state === m.rejectState) return { ...base(), status: 'rejected', halt: 'reject', reason: `Rejeitada: a máquina entrou em ${name(state)} após ${count} passo(s) com a entrada "${word}".` };
    const sym = head < tape.length ? tape[head] : BLANK;
    const d = delta.get(`${state}\u0001${sym}`);
    if (!d)
      return {
        ...base(),
        status: 'rejected',
        halt: 'implicit-reject',
        reason: `Rejeitada: após ${count} passo(s), em ${name(state)} lendo "${sym}", não há transição definida; pela convenção do livro, a máquina vai para q_rejeita (p. 152).`,
      };

    // detecção de laço por configuração repetida (só enquanto a fita é pequena e há orçamento)
    if (budget > 0 && lastNonBlank < LOOP_MAX_TAPE) {
      const key = `${state}\u0001${head}\u0001${tape.slice(0, lastNonBlank + 1).join('\u0002')}`;
      const prev = seen.get(key);
      if (prev !== undefined)
        return {
          ...base(),
          status: 'loop',
          loopFrom: prev,
          loopAt: count,
          reason: `Não para: a configuração do passo ${count} é idêntica à do passo ${prev} (mesmo estado ${name(state)}, mesma posição do cabeçote e mesma fita). Como a máquina é determinística, ela repetirá esse ciclo para sempre, sem aceitar.`,
        };
      seen.set(key, count);
      budget -= key.length;
    }

    if (count >= L.maxSteps)
      return {
        ...base(),
        status: 'inconclusive',
        reason: `Limite de ${L.maxSteps} passos atingido sem a máquina parar (último estado: ${name(state)}). Isso NÃO prova que ela entra em laço: talvez pare depois. Não existe algoritmo geral que decida isso (Teorema 4.11). Aumente o limite para continuar.`,
      };
    if (L.shouldCancel && (count & 4095) === 0 && count > 0 && L.shouldCancel()) throw new TMCancelled();

    const { t, to, edgeId } = d;
    while (tape.length <= head) tape.push(BLANK);
    tape[head] = t.write;
    if (t.write !== BLANK && head > lastNonBlank) lastNonBlank = head;
    else if (t.write === BLANK && head === lastNonBlank) while (lastNonBlank >= 0 && (tape[lastNonBlank] ?? BLANK) === BLANK) lastNonBlank--;
    const newHead = t.move === 'R' ? head + 1 : Math.max(0, head - 1);
    if (record && steps.length < RECORD_CAP) steps.push({ from: state, to, head, newHead, read: sym, write: t.write, move: t.move, edgeId, transitionId: t.id });
    state = to;
    head = newHead;
    if (head > maxHead) maxHead = head;
    count++;
  }
}

export function stateName(m: TM, id: string): string {
  return m.states.find((s) => s.id === id)?.name ?? (id === '' ? '?' : id);
}

/** Configuração k reconstruída do registro. */
export interface TMConfig {
  state: string;
  head: number;
  tape: string[];
}

export function configAt(trace: TMTrace, k: number): TMConfig {
  const tape = [...trace.initialTape];
  const n = Math.min(k, trace.steps.length);
  for (let i = 0; i < n; i++) {
    const s = trace.steps[i];
    while (tape.length <= s.head) tape.push(BLANK);
    tape[s.head] = s.write;
  }
  return n === 0 ? { state: trace.initialState, head: 0, tape } : { state: trace.steps[n - 1].to, head: trace.steps[n - 1].newHead, tape };
}

/**
 * Configuração no formato do livro, u q v: o cabeçote está sobre o primeiro símbolo de v.
 * Brancos à direita do último símbolo não branco são omitidos; quando o cabeçote está sobre um
 * branco além do fim, v = "⊔" (ua qi ≡ ua qi ⊔, p. 148).
 */
export function formatConfig(m: TM, c: TMConfig): string {
  const gamma = tapeAlphabet(m);
  const sep = gamma.some((s) => [...s].length > 1) ? ' ' : '';
  let end = c.tape.length;
  while (end > 0 && c.tape[end - 1] === BLANK) end--;
  const cell = (i: number) => (i < c.tape.length ? c.tape[i] : BLANK);
  const u = Array.from({ length: c.head }, (_, i) => cell(i)).join(sep);
  const v = c.head < end ? c.tape.slice(c.head, end).join(sep) : BLANK;
  const q = stateName(m, c.state);
  return [u, q, v].filter((x) => x !== '').join(' ');
}

/** Explicação de um passo em linguagem direta. */
export function explainTMStep(m: TM, s: TMStep): string {
  const t = { read: s.read, write: s.write, move: s.move };
  const wrote = s.write === s.read ? `mantém "${s.read}"` : `escreve "${s.write}" no lugar de "${s.read}"`;
  const dir = s.move === 'R' ? 'move o cabeçote para a direita (D)' : s.head === 0 ? 'tenta mover para a esquerda (E), mas já está na primeira célula: o cabeçote fica no lugar (p. 146)' : 'move o cabeçote para a esquerda (E)';
  return `${stateName(m, s.from)} lê "${s.read}" na célula ${s.head + 1} por "${tmTransitionLabel(t)}": ${wrote}, ${dir} e vai para ${stateName(m, s.to)}.`;
}

export { MOVE_LABEL };
