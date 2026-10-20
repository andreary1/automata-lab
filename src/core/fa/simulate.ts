import { buildDelta, epsilonClosure, type Delta } from './delta';
import type { FiniteAutomaton } from './model';
import { formatStateSet, stateName } from './model';
import { formatWord, tokenize } from './symbols';
import { validate } from './validate';

/** Resultados distintos usados em todo o app (inclusive nos modelos futuros). */
export type RunStatus = 'accepted' | 'rejected' | 'loop' | 'running' | 'interrupted' | 'inconclusive' | 'invalid';

export const STATUS_LABEL: Record<RunStatus, string> = {
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  loop: 'Não para (laço provado)',
  running: 'Execução em andamento',
  interrupted: 'Interrompida pelo usuário',
  inconclusive: 'Inconclusiva (limite de recursos)',
  invalid: 'Máquina ou entrada inválida',
};

export interface FAStep {
  /** Quantidade de símbolos já consumidos ao final deste passo. */
  consumed: number;
  /** Símbolo lido neste passo (null no passo 0, que só aplica o fecho-ε inicial). */
  symbol: string | null;
  /** Estados obtidos por δ antes do fecho-ε (passo 0: {q0}). */
  moved: string[];
  /** Estados ativos após o fecho-ε. */
  active: string[];
  /** Arestas usadas pela leitura do símbolo. */
  symbolEdges: string[];
  /** Arestas ε percorridas no fecho. */
  epsilonEdges: string[];
  explanation: string;
}

export interface FATrace {
  status: RunStatus;
  tokens: string[];
  steps: FAStep[];
  /** Explicação final de por que a cadeia foi aceita/rejeitada/não executada. */
  reason: string;
  /** Posição (0-based, em símbolos) do erro de entrada, se houver. */
  errorPosition?: number;
  /** Símbolos efetivamente processados (passos executados). */
  processed: number;
}

export interface SimOptions {
  /** Limite de símbolos processados. Excedido → resultado inconclusivo. */
  maxSteps?: number;
  /** Se falso, não guarda os passos (mais rápido para lote). */
  recordTrace?: boolean;
}

export const DEFAULT_MAX_STEPS = 100_000;

/**
 * Simulação de AFD/AFN pela construção "conjunto de estados ativos":
 *  passo 0: A0 = E({q0});
 *  passo i+1: A(i+1) = E( ∪_{r ∈ Ai} δ(r, w(i+1)) ).
 * Aceita sse A_n ∩ F ≠ ∅ — equivalente à definição formal de computação de AFN
 * (Sipser p. 55): existe uma sequência r0..rm com r0 = q0, r(i+1) ∈ δ(ri, yi+1) e rm ∈ F.
 * Para um AFD válido, cada Ai tem exatamente um estado, e isso coincide com a definição da p. 41.
 * Para AFD incompleto, δ ausente leva a ∅ (convenção do app: poço implícito).
 */
export function simulateFA(m: FiniteAutomaton, input: string, opts: SimOptions = {}): FATrace {
  const report = validate(m);
  if (!report.valid) {
    const first = report.issues.find((i) => i.severity === 'error')!;
    return { status: 'invalid', tokens: [], steps: [], processed: 0, reason: `Máquina inválida: ${first.message} ${first.fix}` };
  }
  const tk = tokenize(input, m.alphabet);
  if (!tk.ok) return { status: 'invalid', tokens: tk.tokens, steps: [], processed: 0, reason: `Entrada inválida: ${tk.error}`, errorPosition: tk.position };
  return runTokens(m, buildDelta(m), tk.tokens, opts);
}

export function runTokens(m: FiniteAutomaton, delta: Delta, tokens: string[], opts: SimOptions = {}): FATrace {
  const record = opts.recordTrace !== false;
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const steps: FAStep[] = [];
  const accepting = new Set(m.states.filter((s) => s.accepting).map((s) => s.id));
  const nfa = m.kind === 'nfa';
  const fmt = (ids: Iterable<string>) => formatStateSet(m, ids);
  const word = formatWord(tokens, m.alphabet);

  const q0 = m.initial!;
  const c0 = epsilonClosure(delta, [q0]);
  let active = c0.states;
  if (record) {
    const added = [...c0.states].filter((s) => s !== q0);
    steps.push({
      consumed: 0,
      symbol: null,
      moved: [q0],
      active: [...active],
      symbolEdges: [],
      epsilonEdges: [...c0.usedEdges],
      explanation: nfa
        ? `Início: ativa o estado inicial ${stateName(m, q0)}` +
          (added.length ? ` e, pelo fecho-ε, também ${fmt(added)}. Estados ativos: ${fmt(active)}.` : `. O fecho-ε não acrescenta estados.`)
        : `Início no estado inicial ${stateName(m, q0)}.`,
    });
  }

  for (let i = 0; i < tokens.length; i++) {
    if (i >= maxSteps) {
      return {
        status: 'inconclusive',
        tokens,
        steps,
        processed: i,
        reason: `Limite de ${maxSteps} passos atingido após ler ${i} de ${tokens.length} símbolos. Isso não indica rejeição; aumente o limite para continuar.`,
      };
    }
    const a = tokens[i];
    const moved = new Set<string>();
    const symbolEdges: string[] = [];
    const missingFrom: string[] = [];
    for (const r of active) {
      const entry = delta.get(r)?.get(a);
      if (!entry || entry.targets.size === 0) {
        missingFrom.push(r);
        continue;
      }
      for (const t of entry.targets) {
        moved.add(t);
        const e = entry.edgeByTarget.get(t);
        if (e) symbolEdges.push(e);
      }
    }
    const closure = epsilonClosure(delta, moved);
    const prev = active;
    active = closure.states;

    if (record) {
      let explanation: string;
      if (nfa) {
        const added = [...closure.states].filter((s) => !moved.has(s));
        explanation =
          `Lê "${a}" (símbolo ${i + 1}). δ aplicada a ${fmt(prev)} resulta em ${fmt(moved)}` +
          (added.length ? `; o fecho-ε acrescenta ${fmt(added)}` : '') +
          `. Estados ativos: ${fmt(active)}.` +
          (missingFrom.length && moved.size > 0 ? ` Ramos em ${fmt(missingFrom)} morrem (sem transição para "${a}").` : '') +
          (active.size === 0 ? ' Nenhum ramo sobrevive.' : '');
      } else {
        const r = [...prev][0];
        explanation =
          moved.size > 0
            ? `Lê "${a}" (símbolo ${i + 1}): δ(${stateName(m, r)}, ${a}) = ${stateName(m, [...moved][0])}.`
            : `Lê "${a}" (símbolo ${i + 1}): δ(${stateName(m, r)}, ${a}) não está definida. Pela convenção do app, a computação vai para um poço implícito e a cadeia será rejeitada.`;
      }
      steps.push({
        consumed: i + 1,
        symbol: a,
        moved: [...moved],
        active: [...active],
        symbolEdges,
        epsilonEdges: [...closure.usedEdges],
        explanation,
      });
    }

    if (active.size === 0) {
      return {
        status: 'rejected',
        tokens,
        steps,
        processed: i + 1,
        reason: nfa
          ? `Rejeitada: depois de ler ${i + 1} símbolo(s), nenhum ramo da computação continua ativo, então nenhum caminho consome toda a entrada "${word}".`
          : `Rejeitada: δ(${stateName(m, [...prev][0] ?? '')}, ${a}) não está definida (AFD incompleto; poço implícito).`,
      };
    }
  }

  const hits = [...active].filter((s) => accepting.has(s));
  if (hits.length > 0) {
    return {
      status: 'accepted',
      tokens,
      steps,
      processed: tokens.length,
      reason: nfa
        ? `Aceita: após consumir toda a entrada "${word}", os estados ativos ${fmt(active)} incluem o(s) estado(s) de aceitação ${fmt(hits)}. Basta um ramo terminar em F.`
        : `Aceita: após consumir toda a entrada "${word}", a máquina está em ${stateName(m, hits[0])}, que pertence a F.`,
    };
  }
  return {
    status: 'rejected',
    tokens,
    steps,
    processed: tokens.length,
    reason: nfa
      ? `Rejeitada: toda a entrada "${word}" foi consumida, mas nenhum dos estados ativos ${fmt(active)} pertence a F.`
      : `Rejeitada: toda a entrada "${word}" foi consumida e a máquina terminou em ${stateName(m, [...active][0])}, que não pertence a F.`,
  };
}

