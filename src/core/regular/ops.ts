import { addCState, addCTrans, newCNFA, unionAlphabet, uniqueNames, type CNFA } from './compact';
import { checkCancel, checkStates, DEFAULT_BUDGET, type Budget } from './budget';
import { toCompleteDFA } from './subset';

export type OpKind = 'union' | 'concat' | 'star' | 'intersection' | 'complement' | 'difference';

export interface OpResult {
  machine: CNFA;
  deterministic: boolean;
  /** Σ usado na operação (sempre explícito). */
  alphabet: string[];
  /** Passos e convenções aplicadas, em linguagem natural. */
  notes: string[];
  /** Fundamentação: teorema do livro ou "complementar". */
  basis: string;
}

/** Copia os estados de `src` para `dst` com prefixo no nome; devolve o mapa de índices. */
function embed(dst: CNFA, src: CNFA, prefix: string): number[] {
  const map = src.names.map((name) => addCState(dst, `${prefix}${name}`, false));
  src.trans.forEach((row, q) => row.forEach((ts, a) => ts.forEach((t) => addCTrans(dst, map[q], a, map[t]))));
  src.eps.forEach((ts, q) => ts.forEach((t) => addCTrans(dst, map[q], null, map[t])));
  return map;
}

function freshName(c: CNFA, base: string) {
  let n = base;
  while (c.names.includes(n)) n += '′';
  return n;
}

function alphaNote(A: CNFA, B: CNFA | null, Σ: string[]): string[] {
  const extra = B ? Σ.filter((a) => !A.alphabet.includes(a) || !B.alphabet.includes(a)) : [];
  return extra.length
    ? [`Os alfabetos diferem; usamos Σ = Σ₁ ∪ Σ₂ = {${Σ.join(', ')}} (como sugere o livro na prova do Teorema 1.25). Símbolos que uma máquina não conhecia simplesmente não têm transição nela.`]
    : [`Σ = {${Σ.join(', ')}}.`];
}

/** Teorema 1.45: AFN para A ∪ B com novo estado inicial e setas ε. */
export function unionNFA(A: CNFA, B: CNFA, budget: Budget = DEFAULT_BUDGET): OpResult {
  const Σ = unionAlphabet(A.alphabet, B.alphabet);
  const c = newCNFA(Σ);
  const q0 = addCState(c, 'q0');
  const ma = embed(c, A, 'A.');
  const mb = embed(c, B, 'B.');
  A.accept.forEach((f, q) => f && (c.accept[ma[q]] = true));
  B.accept.forEach((f, q) => f && (c.accept[mb[q]] = true));
  addCTrans(c, q0, null, ma[A.start]);
  addCTrans(c, q0, null, mb[B.start]);
  c.start = q0;
  checkStates(budget, c.names.length, 'A união');
  return {
    machine: c,
    deterministic: false,
    alphabet: Σ,
    basis: 'Sipser, Teorema 1.45 (construção por AFN)',
    notes: [...alphaNote(A, B, Σ), 'Estados de A recebem o prefixo "A." e os de B, "B.".', 'Novo estado inicial q0 com setas ε para os iniciais de A e de B; F = F_A ∪ F_B.'],
  };
}

/** Teorema 1.47: AFN para A ∘ B. */
export function concatNFA(A: CNFA, B: CNFA, budget: Budget = DEFAULT_BUDGET): OpResult {
  const Σ = unionAlphabet(A.alphabet, B.alphabet);
  const c = newCNFA(Σ);
  const ma = embed(c, A, 'A.');
  const mb = embed(c, B, 'B.');
  B.accept.forEach((f, q) => f && (c.accept[mb[q]] = true));
  A.accept.forEach((f, q) => f && addCTrans(c, ma[q], null, mb[B.start]));
  c.start = ma[A.start];
  checkStates(budget, c.names.length, 'A concatenação');
  return {
    machine: c,
    deterministic: false,
    alphabet: Σ,
    basis: 'Sipser, Teorema 1.47 (construção por AFN)',
    notes: [...alphaNote(A, B, Σ), 'O inicial é o de A. Cada estado de aceitação de A ganha uma seta ε para o inicial de B; F = F_B.'],
  };
}

/** Teorema 1.49: AFN para A*. */
export function starNFA(A: CNFA, budget: Budget = DEFAULT_BUDGET): OpResult {
  const c = newCNFA(A.alphabet);
  const ma = embed(c, A, '');
  const q0 = addCState(c, freshName(c, 'q_novo'), true);
  A.accept.forEach((f, q) => {
    if (f) {
      c.accept[ma[q]] = true;
      addCTrans(c, ma[q], null, ma[A.start]);
    }
  });
  addCTrans(c, q0, null, ma[A.start]);
  c.start = q0;
  c.names = uniqueNames(c.names);
  checkStates(budget, c.names.length, 'A estrela');
  return {
    machine: c,
    deterministic: false,
    alphabet: [...A.alphabet],
    basis: 'Sipser, Teorema 1.49 (construção por AFN)',
    notes: [
      `Σ = {${A.alphabet.join(', ')}}.`,
      'Novo estado inicial (de aceitação, para que ε ∈ A*) com seta ε para o inicial antigo; cada estado de aceitação ganha seta ε de volta ao inicial antigo.',
      'Apenas tornar o inicial antigo de aceitação seria incorreto em geral (Sipser, p. 63–64).',
    ],
  };
}

/** Produto de AFDs completos; `acc` decide aceitação do par. Só pares alcançáveis. */
function product(A: CNFA, B: CNFA, Σ: string[], acc: (a: boolean, b: boolean) => boolean, budget: Budget): CNFA {
  const c = newCNFA(Σ);
  const index = new Map<string, number>();
  const pairs: [number, number][] = [];
  const get = (p: number, q: number) => {
    const k = `${p},${q}`;
    let i = index.get(k);
    if (i === undefined) {
      i = addCState(c, `(${A.names[p]}, ${B.names[q]})`, acc(A.accept[p], B.accept[q]));
      index.set(k, i);
      pairs.push([p, q]);
      checkStates(budget, pairs.length, 'O produto');
    }
    return i;
  };
  c.start = get(A.start, B.start);
  for (let i = 0; i < pairs.length; i++) {
    checkCancel(budget);
    const [p, q] = pairs[i];
    for (const a of Σ) addCTrans(c, i, a, get(A.trans[p].get(a)![0], B.trans[q].get(a)![0]));
  }
  return c;
}

function dfaNotes(name: string, r: { determinized: boolean; addedSink: boolean }): string[] {
  const out: string[] = [];
  if (r.determinized) out.push(`${name} não era determinística: foi convertida em AFD pela construção dos subconjuntos (Teorema 1.39).`);
  if (r.addedSink) out.push(`${name} foi completada com um estado poço ∅ para ter δ total sobre Σ.`);
  return out;
}

/** Interseção pelo produto cartesiano com F = F1 × F2 (Sipser, nota da prova do Teorema 1.25). */
export function intersectionDFA(A: CNFA, B: CNFA, budget: Budget = DEFAULT_BUDGET): OpResult {
  const Σ = unionAlphabet(A.alphabet, B.alphabet);
  const da = toCompleteDFA(A, Σ, budget);
  const db = toCompleteDFA(B, Σ, budget);
  const c = product(da.dfa, db.dfa, Σ, (x, y) => x && y, budget);
  return {
    machine: c,
    deterministic: true,
    alphabet: Σ,
    basis: 'Sipser, construção do produto (prova do Teorema 1.25) com F = F₁ × F₂ (nota de rodapé 3, p. 47)',
    notes: [...alphaNote(A, B, Σ), ...dfaNotes('A', da), ...dfaNotes('B', db), 'Estados são pares (estado de A, estado de B); só os pares alcançáveis são gerados. Um par aceita quando ambos aceitam.'],
  };
}

/** A − B = A ∩ complemento(B), pelo produto com F = F1 × (Q2 − F2). */
export function differenceDFA(A: CNFA, B: CNFA, budget: Budget = DEFAULT_BUDGET): OpResult {
  const Σ = unionAlphabet(A.alphabet, B.alphabet);
  const da = toCompleteDFA(A, Σ, budget);
  const db = toCompleteDFA(B, Σ, budget);
  const c = product(da.dfa, db.dfa, Σ, (x, y) => x && !y, budget);
  return {
    machine: c,
    deterministic: true,
    alphabet: Σ,
    basis: 'Complementar: A − B = A ∩ B̄, combinando o produto (Teorema 1.25) e o complemento de AFD completo',
    notes: [...alphaNote(A, B, Σ), ...dfaNotes('A', da), ...dfaNotes('B', db), 'Um par aceita quando A aceita e B não aceita.'],
  };
}

/**
 * Complemento em relação a Σ* para o Σ informado. Exige AFD COMPLETO sobre Σ: um AFN é
 * determinizado primeiro (inverter F num AFN NÃO dá o complemento), e transições ausentes
 * ou símbolos novos de Σ vão para um poço, que passa a ser de aceitação.
 */
export function complementDFA(A: CNFA, alphabet: string[], budget: Budget = DEFAULT_BUDGET): OpResult {
  const missing = A.alphabet.filter((a) => !alphabet.includes(a));
  if (missing.length) throw new Error(`Σ do complemento precisa conter o alfabeto da máquina; faltam: ${missing.join(', ')}.`);
  const d = toCompleteDFA(A, alphabet, budget);
  const c: CNFA = { ...d.dfa, accept: d.dfa.accept.map((x) => !x) };
  return {
    machine: c,
    deterministic: true,
    alphabet: [...alphabet],
    basis: 'Complemento de AFD completo (troca F por Q − F), como usado na prova do Teorema 4.5',
    notes: [
      `O complemento é relativo a Σ* com Σ = {${alphabet.join(', ')}}: contém toda cadeia sobre esse Σ que a máquina não aceita.`,
      ...dfaNotes('A máquina', d),
      'Depois de obter um AFD completo, os estados de aceitação e de não aceitação são trocados.',
    ],
  };
}
