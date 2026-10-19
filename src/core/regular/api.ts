import type { FiniteAutomaton } from '../fa/model';
import { validate } from '../fa/validate';
import { formatWord } from '../fa/symbols';
import { fromCNFA, toCNFA, type CNFA } from './compact';
import { CancelledError, DEFAULT_BUDGET, LimitError, type Budget } from './budget';
import { checkEquivalence } from './equivalence';
import { minimizeDFA } from './minimize';
import { complementDFA, concatNFA, differenceDFA, intersectionDFA, starNFA, unionNFA, type OpResult } from './ops';
import { fullyParenthesized, parseRegex, RegexSyntaxError } from './regex';
import { regexToNfa } from './regexToNfa';
import { formatSubset, subsetConstruction, toCompleteDFA } from './subset';
import { faToRegex, type GnfaStep } from './toRegex';

/**
 * Fachada da Etapa 2: recebe máquinas do editor ou expressões regulares, valida,
 * executa os algoritmos e devolve resultados serializáveis (usados no Web Worker).
 */

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export type Operand = { kind: 'machine'; machine: FiniteAutomaton; label: string } | { kind: 'regex'; src: string; alphabet: string[] | null; label: string };

function machineToCNFA(m: FiniteAutomaton, label: string): CNFA {
  const r = validate(m);
  if (!r.valid) {
    const e = r.issues.find((i) => i.severity === 'error')!;
    throw new InvalidInputError(`"${label}" não é uma máquina válida: ${e.message} ${e.fix}`);
  }
  return toCNFA(m);
}

function operandToCNFA(o: Operand, budget: Budget): CNFA {
  if (o.kind === 'machine') return machineToCNFA(o.machine, o.label);
  const p = parseRegex(o.src, { alphabet: o.alphabet });
  return regexToNfa(p.re, p.alphabet, budget);
}

export interface MachineResult {
  machine: FiniteAutomaton;
  notes: string[];
  basis: string;
}

// ---------------- AFN → AFD ----------------
export interface SubsetTable {
  columns: string[];
  rows: { name: string; subset: string; initial: boolean; accepting: boolean; targets: string[] }[];
}
export function opNfaToDfa(m: FiniteAutomaton, label: string, budget: Budget = DEFAULT_BUDGET): MachineResult & { table: SubsetTable; possible: number } {
  const c = machineToCNFA(m, label);
  const r = subsetConstruction(c, budget);
  const machine = fromCNFA(r.dfa, 'dfa');
  const table: SubsetTable = {
    columns: c.alphabet,
    rows: r.rows.map((row) => ({
      name: r.dfa.names[row.state],
      subset: formatSubset(c, row.subset),
      initial: row.state === r.dfa.start,
      accepting: row.accepting,
      targets: row.targets.map((t) => r.dfa.names[t]),
    })),
  };
  const notes = [
    `Estado inicial do AFD: E({${c.names[c.start]}}) = ${r.dfa.names[r.dfa.start]}.`,
    `Foram gerados ${r.dfa.names.length} subconjuntos alcançáveis, dos ${r.possible} possíveis (2^${c.names.length}). Os demais não são alcançáveis a partir do inicial e não alteram a linguagem (o livro os remove na Figura 1.44).`,
    'Cada estado do AFD é rotulado pelo conjunto de estados do AFN que ele representa.',
    'Um estado do AFD é de aceitação quando contém algum estado de aceitação do AFN.',
  ];
  if (m.kind === 'dfa') notes.unshift('A máquina de entrada já é um AFD; a construção funciona do mesmo modo e produz um AFD completo equivalente.');
  return { machine, table, possible: r.possible, notes, basis: 'Sipser, Teorema 1.39 (construção dos subconjuntos com fecho-ε) e Exemplo 1.41' };
}

// ---------------- Minimização ----------------
export function opMinimize(m: FiniteAutomaton, label: string, budget: Budget = DEFAULT_BUDGET): MachineResult & { rounds: string[][][]; blocks: string[][]; removed: string[]; before: number; after: number } {
  const c = machineToCNFA(m, label);
  const d = toCompleteDFA(c, c.alphabet, budget);
  const notes: string[] = [];
  if (d.determinized) notes.push(`A máquina não é determinística: foi convertida em AFD pela construção dos subconjuntos (${d.dfa.names.length} estados alcançáveis).`);
  if (d.addedSink) notes.push('O AFD era incompleto: foi completado com um estado poço ∅ antes de minimizar.');
  const r = minimizeDFA(d.dfa, budget);
  if (r.removedUnreachable.length) notes.push(`Estados inalcançáveis removidos: ${r.removedUnreachable.join(', ')}.`);
  notes.push(`Refinamento de partição: ${r.rounds.length} rodada(s) até estabilizar. Estados que terminam no mesmo bloco são indistinguíveis e viram um só estado.`);
  notes.push(`Resultado: ${r.dfa.names.length} estado(s), contra ${d.dfa.names.length} no AFD completo de entrada.`);
  return {
    machine: fromCNFA(r.dfa, 'dfa'),
    rounds: r.rounds,
    blocks: r.blocks.map((b) => b.map((q) => d.dfa.names[q])),
    removed: r.removedUnreachable,
    before: d.dfa.names.length,
    after: r.dfa.names.length,
    notes,
    basis: 'Algoritmo complementar (não está no texto do livro consultado): remoção de inalcançáveis + refinamento de partição de Moore',
  };
}

// ---------------- ER → AFN ----------------
export function opRegexToNfa(src: string, alphabet: string[] | null, budget: Budget = DEFAULT_BUDGET): MachineResult & { parsed: string; full: string; alphabet: string[] } {
  const p = parseRegex(src, { alphabet });
  const c = regexToNfa(p.re, p.alphabet, budget);
  return {
    machine: fromCNFA(c, 'nfa'),
    parsed: p.re.str,
    full: fullyParenthesized(p.re),
    alphabet: p.alphabet,
    notes: [
      `Leitura da expressão (totalmente parentizada): ${fullyParenthesized(p.re)}`,
      `Σ = {${p.alphabet.join(', ')}}${alphabet ? '' : ' (inferido dos símbolos usados)'}.`,
      `AFN com ${c.names.length} estados, montado pelas construções do Lema 1.55 (sem simplificações, por isso pode ter mais estados que o necessário; use Minimizar para reduzir).`,
    ],
    basis: 'Sipser, Lema 1.55 (casos 1–6, com as construções dos Teoremas 1.45, 1.47 e 1.49)',
  };
}

// ---------------- AF → ER ----------------
export interface ToRegexOutput {
  regex: string;
  full: string;
  steps: GnfaStep[];
  order: string[];
  simplified: boolean;
  /** Verificação exata: a ER obtida, convertida de volta em AFN, é equivalente à máquina? */
  verified: 'equivalent' | 'not-equivalent' | 'skipped';
  verifyNote: string;
  basis: string;
  notes: string[];
}
export function opToRegex(m: FiniteAutomaton, label: string, opts: { simplify?: boolean; order?: 'heuristic' | 'listed' }, budget: Budget = DEFAULT_BUDGET): ToRegexOutput {
  const c = machineToCNFA(m, label);
  const r = faToRegex(c, opts, budget);
  let verified: ToRegexOutput['verified'] = 'skipped';
  let verifyNote = '';
  try {
    const back = regexToNfa(r.regex, c.alphabet, budget);
    const eq = checkEquivalence(c, back, budget);
    verified = eq.equivalent ? 'equivalent' : 'not-equivalent';
    verifyNote = eq.equivalent
      ? 'Verificado com método exato: a expressão foi convertida de volta em AFN (Lema 1.55) e comparada com a máquina pelo teste de equivalência (Teorema 4.5).'
      : `ERRO INTERNO: a expressão não é equivalente à máquina (contraexemplo "${formatWord(eq.counterexample, c.alphabet)}"). Por favor, reporte.`;
  } catch (e) {
    verifyNote = `A verificação automática não foi concluída: ${(e as Error).message}`;
  }
  return {
    regex: r.regex.str,
    full: fullyParenthesized(r.regex),
    steps: r.steps,
    order: r.order,
    simplified: r.simplified,
    verified,
    verifyNote,
    basis: 'Sipser, Lema 1.60 (AFNG, Definição 1.64 e procedimento CONVERT)',
    notes: [
      `Ordem de remoção: ${r.order.join(', ') || '(nenhum estado intermediário)'}.`,
      r.simplified
        ? 'Simplificações aplicadas a cada passo (preservam a linguagem): R ∪ ∅ = R, R ∪ R = R, ε ∪ R* = R*, Rε = εR = R, R∅ = ∅R = ∅, ∅* = ε, ε* = ε, (R*)* = R*.'
        : 'Sem simplificações: a fórmula (R1)(R2)*(R3) ∪ (R4) é aplicada como está; apenas pares sem seta (∅) são omitidos.',
      ...(m.kind === 'nfa' ? ['O livro enuncia o método para AFD; aplicá-lo diretamente a um AFN é uma extensão válida, pois um AFN com os dois estados novos já é um AFNG no formato especial.'] : []),
      'Ordens de remoção diferentes produzem expressões diferentes, todas equivalentes.',
    ],
  };
}

// ---------------- Operações ----------------
export type BinaryOp = 'union' | 'concat' | 'intersection' | 'difference';
export function opBinary(op: BinaryOp, a: Operand, b: Operand, budget: Budget = DEFAULT_BUDGET): MachineResult {
  const A = operandToCNFA(a, budget);
  const B = operandToCNFA(b, budget);
  const r: OpResult = op === 'union' ? unionNFA(A, B, budget) : op === 'concat' ? concatNFA(A, B, budget) : op === 'intersection' ? intersectionDFA(A, B, budget) : differenceDFA(A, B, budget);
  return { machine: fromCNFA(r.machine, r.deterministic ? 'dfa' : 'nfa'), notes: [`A = ${a.label}; B = ${b.label}.`, ...r.notes], basis: r.basis };
}
export function opStar(a: Operand, budget: Budget = DEFAULT_BUDGET): MachineResult {
  const r = starNFA(operandToCNFA(a, budget), budget);
  return { machine: fromCNFA(r.machine, 'nfa'), notes: [`A = ${a.label}.`, ...r.notes], basis: r.basis };
}
export function opComplement(a: Operand, alphabet: string[], budget: Budget = DEFAULT_BUDGET): MachineResult {
  const A = operandToCNFA(a, budget);
  const missing = A.alphabet.filter((x) => !alphabet.includes(x));
  if (missing.length) throw new InvalidInputError(`O Σ do complemento precisa conter o alfabeto da máquina. Faltam: ${missing.join(', ')}.`);
  const r = complementDFA(A, alphabet, budget);
  return { machine: fromCNFA(r.machine, 'dfa'), notes: [`A = ${a.label}.`, ...r.notes], basis: r.basis };
}

// ---------------- Equivalência ----------------
export interface EquivalenceOutput {
  equivalent: boolean;
  alphabet: string[];
  counterexample?: string;
  counterexampleTokens?: string[];
  acceptedBy?: string;
  rejectedBy?: string;
  explored: number;
  sizes: [number, number];
  notes: string[];
  basis: string;
}
export function opEquivalence(a: Operand, b: Operand, budget: Budget = DEFAULT_BUDGET): EquivalenceOutput {
  const A = operandToCNFA(a, budget);
  const B = operandToCNFA(b, budget);
  const r = checkEquivalence(A, B, budget);
  const basis = 'Sipser, Teorema 4.5 (EQ_AFD decidível via diferença simétrica vazia) e Teorema 4.4 (teste de vacuidade por alcançabilidade)';
  if (r.equivalent) return { equivalent: true, alphabet: r.alphabet, explored: r.explored, sizes: r.sizes, notes: r.notes, basis };
  const word = formatWord(r.counterexample, r.alphabet);
  return {
    equivalent: false,
    alphabet: r.alphabet,
    counterexample: word,
    counterexampleTokens: r.counterexample,
    acceptedBy: r.acceptedBy === 'A' ? a.label : b.label,
    rejectedBy: r.acceptedBy === 'A' ? b.label : a.label,
    explored: r.explored,
    sizes: r.sizes,
    notes: [...r.notes, 'O contraexemplo é uma cadeia de comprimento mínimo da diferença simétrica (busca em largura no produto).'],
    basis,
  };
}

// ---------------- Erros serializáveis ----------------
export type OpError = { kind: 'limit' | 'cancelled' | 'invalid' | 'syntax' | 'internal'; message: string; position?: number };
export function toOpError(e: unknown): OpError {
  if (e instanceof LimitError) return { kind: 'limit', message: e.message };
  if (e instanceof CancelledError) return { kind: 'cancelled', message: e.message };
  if (e instanceof InvalidInputError) return { kind: 'invalid', message: e.message };
  if (e instanceof RegexSyntaxError) return { kind: 'syntax', message: e.message, position: e.position };
  return { kind: 'internal', message: e instanceof Error ? e.message : String(e) };
}
