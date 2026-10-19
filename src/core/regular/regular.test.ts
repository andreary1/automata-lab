import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import type { FiniteAutomaton } from '../fa/model';
import { simulateFA } from '../fa/simulate';
import { validate } from '../fa/validate';
import { opBinary, opComplement, opEquivalence, opMinimize, opNfaToDfa, opRegexToNfa, opStar, opToRegex, toOpError, type Operand } from './api';
import { CancelledError, LimitError } from './budget';
import { toCNFA } from './compact';
import { checkEquivalence } from './equivalence';
import { fullyParenthesized, parseRegex, RegexSyntaxError } from './regex';
import { subsetConstruction } from './subset';

const ex = (k: string) => structuredClone(EXAMPLES.find((e) => e.key === k)!.machine);
const M = (m: FiniteAutomaton, label = 'M'): Operand => ({ kind: 'machine', machine: m, label });
const RE = (src: string, alphabet: string[] | null = ['0', '1']): Operand => ({ kind: 'regex', src, alphabet, label: src });
const eq = (a: Operand, b: Operand) => opEquivalence(a, b).equivalent;
const machine = (src: string, alphabet: string[] | null = ['0', '1']) => opRegexToNfa(src, alphabet).machine;

function words(alphabet: string[], n: number): string[][] {
  const out: string[][] = [[]];
  let layer: string[][] = [[]];
  for (let i = 0; i < n; i++) out.push(...(layer = layer.flatMap((w) => alphabet.map((a) => [...w, a]))));
  return out;
}
const accepts = (m: FiniteAutomaton, w: string[]) => simulateFA(m, m.alphabet.some((a) => a.length > 1) ? w.join(' ') : w.join('')).status === 'accepted';

/** Teste complementar (amostragem): NÃO é prova; as provas usam checkEquivalence. */
function agreesWith(m: FiniteAutomaton, pred: (w: string) => boolean, n = 8) {
  for (const w of words(m.alphabet, n)) expect([w.join(''), accepts(m, w)]).toEqual([w.join(''), pred(w.join(''))]);
}

/** AFD de três estados da Figura 1.69(a) (Exemplo 1.68). */
function dfa168(): FiniteAutomaton {
  const s = (id: string, acc: boolean) => ({ id, name: id, x: 0, y: 0, accepting: acc });
  const e = (from: string, to: string, symbols: string[]) => ({ id: `${from}${to}`, from, to, symbols, epsilon: false });
  return {
    kind: 'dfa', alphabet: ['a', 'b'], initial: '1',
    states: [s('1', false), s('2', true), s('3', true)],
    edges: [e('1', '2', ['a']), e('1', '3', ['b']), e('2', '1', ['a']), e('2', '2', ['b']), e('3', '2', ['a']), e('3', '1', ['b'])],
  };
}

describe('AFN → AFD (construção dos subconjuntos)', () => {
  it('reproduz o AFD da Figura 1.44 para N₄ (Exemplo 1.41)', () => {
    const r = opNfaToDfa(ex('sipser-n4'), 'N4');
    const row = (n: string) => r.table.rows.find((x) => x.name === n)!;
    expect(r.table.rows).toHaveLength(6);
    expect(r.table.rows.find((x) => x.initial)!.name).toBe('{q1, q3}');
    // colunas: a, b
    expect(row('{q1, q3}').targets).toEqual(['{q1, q3}', '{q2}']);
    expect(row('{q2}').targets).toEqual(['{q2, q3}', '{q3}']);
    expect(row('{q3}').targets).toEqual(['{q1, q3}', '∅']);
    expect(row('{q2, q3}').targets).toEqual(['{q1, q2, q3}', '{q3}']);
    expect(row('{q1, q2, q3}').targets).toEqual(['{q1, q2, q3}', '{q2, q3}']);
    expect(row('∅').targets).toEqual(['∅', '∅']);
    expect(r.table.rows.filter((x) => x.accepting).map((x) => x.name).sort()).toEqual(['{q1, q2, q3}', '{q1, q3}']);
    expect(r.possible).toBe(8);
    expect(validate(r.machine)).toMatchObject({ valid: true, incompleteDfa: false });
    expect(eq(M(r.machine), M(ex('sipser-n4')))).toBe(true);
  });
  it('preserva a linguagem em todos os exemplos (equivalência exata)', () => {
    for (const e of EXAMPLES) {
      const r = opNfaToDfa(e.machine, e.title);
      expect(r.machine.kind).toBe('dfa');
      expect(validate(r.machine).valid).toBe(true);
      expect([e.key, eq(M(r.machine), M(e.machine))]).toEqual([e.key, true]);
    }
  });
  it('ciclos ε não travam e o fecho entra no estado inicial', () => {
    const r = opNfaToDfa(ex('eps-cycle'), 'ciclo');
    expect(r.table.rows.find((x) => x.initial)!.subset).toBe('{q0, q1, q2}');
  });
  it('respeita o limite de estados (inconclusivo, não erro silencioso)', () => {
    const big = machine('(a ∪ b)*a(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)', ['a', 'b']);
    expect(() => opNfaToDfa(big, 'grande', { maxStates: 1000, maxRegexLength: 1e5 })).toThrow(LimitError);
    expect(toOpError(new LimitError('x')).kind).toBe('limit');
  });
  it('cancelamento interrompe a construção', () => {
    const big = machine('(a ∪ b)*a(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)(a ∪ b)', ['a', 'b']);
    expect(() => subsetConstruction(toCNFA(big), { maxStates: 1e6, maxRegexLength: 1e5, shouldCancel: () => true })).toThrow(CancelledError);
  });
});

describe('minimização (algoritmo complementar)', () => {
  it('AFD já mínimo não muda de tamanho', () => {
    expect(opMinimize(ex('ends-01'), 'x').after).toBe(3);
    expect(opMinimize(ex('even-ones'), 'x').after).toBe(2);
  });
  it('N₁ (contém 11 ou 101) → AFD mínimo de 4 estados, equivalente', () => {
    const r = opMinimize(ex('sipser-n1'), 'N1');
    expect(r.after).toBe(4);
    expect(eq(M(r.machine), M(ex('sipser-n1')))).toBe(true);
  });
  it('junta estados equivalentes e remove inalcançáveis', () => {
    const m = ex('even-ones');
    // duplica "par" num estado equivalente e acrescenta um inalcançável
    m.states.push({ id: 'p2', name: 'par2', x: 0, y: 0, accepting: true }, { id: 'z', name: 'z', x: 0, y: 0, accepting: false });
    m.edges = m.edges.map((e) => (e.from === 's_ímpar' && e.to === 's_par' ? { ...e, to: 'p2' } : e));
    m.edges.push({ id: 'x1', from: 'p2', to: 'p2', symbols: ['0'], epsilon: false }, { id: 'x2', from: 'p2', to: 's_ímpar', symbols: ['1'], epsilon: false }, { id: 'x3', from: 'z', to: 'z', symbols: ['0', '1'], epsilon: false });
    const r = opMinimize(m, 'dup');
    expect(r.removed).toEqual(['z']);
    expect(r.after).toBe(2);
    expect(r.blocks.some((b) => b.includes('par') && b.includes('par2'))).toBe(true);
    expect(eq(M(r.machine), M(ex('even-ones')))).toBe(true);
  });
  it('AFD incompleto é completado antes; AFN é determinizado antes', () => {
    const m = ex('ends-01');
    m.edges.pop();
    expect(opMinimize(m, 'x').notes.join(' ')).toMatch(/poço/);
    expect(opMinimize(ex('sipser-n4'), 'N4').notes.join(' ')).toMatch(/subconjuntos/);
  });
  it('linguagem vazia minimiza para 1 estado', () => {
    expect(opMinimize(machine('∅'), 'v').after).toBe(1);
  });
});

describe('expressões regulares: sintaxe', () => {
  const P = (s: string, a: string[] | null = ['a', 'b']) => parseRegex(s, { alphabet: a });
  it('precedência: estrela > concatenação > união (p. 66)', () => {
    expect(fullyParenthesized(P('ab ∪ a*').re)).toBe('((a ∘ b) ∪ (a)*)');
    expect(fullyParenthesized(P('(ab ∪ a)*').re)).toBe('(((a ∘ b) ∪ a))*');
    expect(P('a|b').re.str).toBe('a ∪ b');
    expect(P('a ∘ b').re.str).toBe('ab');
  });
  it('ε, ∅, Σ e R⁺', () => {
    expect(P('ε').re.t).toBe('eps');
    expect(P('∅').re.t).toBe('empty');
    expect(P('{}').re.t).toBe('empty');
    expect(fullyParenthesized(P('Σ').re)).toBe('(a ∪ b)');
    expect(fullyParenthesized(P('a⁺').re)).toBe('(a ∘ (a)*)');
    expect(fullyParenthesized(P('a^+').re)).toBe('(a ∘ (a)*)');
  });
  it('símbolos de vários caracteres entre < >', () => {
    expect(P('<RESET>1*', ['RESET', '1']).re.str).toBe('<RESET>1*');
  });
  it('erros com posição e mensagem útil', () => {
    const err = (s: string, a: string[] | null = ['a', 'b']) => {
      try {
        P(s, a);
      } catch (e) {
        expect(e).toBeInstanceOf(RegexSyntaxError);
        return e as RegexSyntaxError;
      }
      throw new Error(`esperava erro em ${s}`);
    };
    expect(err('a+b').message).toMatch(/ambíguo/);
    expect(err('(ab').message).toMatch(/fechar/);
    expect(err('ab)').message).toMatch(/sem "\("/);
    expect(err('').message).toMatch(/vazia/);
    expect(err('∪a').message).toMatch(/esquerdo/);
    expect(err('a∪').message).toMatch(/direito/);
    expect(err('*a').message).toMatch(/depois/);
    expect(err('()').message).toMatch(/vazios/);
    const e = err('abx');
    expect(e.position).toBe(2);
    expect(e.message).toMatch(/não pertence a Σ/);
  });
  it('Σ inferido quando não informado', () => {
    expect(P('ba*', null).alphabet).toEqual(['b', 'a']);
  });
});

describe('ER → AFN (Lema 1.55)', () => {
  it('(ab ∪ a)* gera o AFN de 8 estados do Exemplo 1.56', () => {
    const r = opRegexToNfa('(ab ∪ a)*', ['a', 'b']);
    expect(r.machine.states).toHaveLength(8);
    expect(validate(r.machine).valid).toBe(true);
    agreesWith(r.machine, (w) => /^(ab|a)*$/.test(w)); // referência de teste apenas
  });
  it('casos base: a, ε, ∅', () => {
    expect(opRegexToNfa('a', ['a']).machine.states).toHaveLength(2);
    expect(opRegexToNfa('ε', ['a']).machine.states).toHaveLength(1);
    expect(simulateFA(machine('ε'), '').status).toBe('accepted');
    expect(simulateFA(machine('∅'), '').status).toBe('rejected');
  });
  it('identidades do Exemplo 1.53 e das p. 67–68 (equivalência exata)', () => {
    expect(eq(RE('(0 ∪ ε)1*'), RE('01* ∪ 1*'))).toBe(true); // item 9
    expect(eq(RE('(0 ∪ ε)(1 ∪ ε)'), RE('ε ∪ 0 ∪ 1 ∪ 01'))).toBe(true); // item 10
    expect(eq(RE('1*∅'), RE('∅'))).toBe(true); // item 11
    expect(eq(RE('∅*'), RE('ε'))).toBe(true); // item 12
    expect(eq(RE('0 ∪ ∅'), RE('0'))).toBe(true); // R ∪ ∅ = R
    expect(eq(RE('0ε'), RE('0'))).toBe(true); // R ∘ ε = R
    expect(eq(RE('0 ∪ ε'), RE('0'))).toBe(false); // R ∪ ε pode diferir de R
    expect(eq(RE('0∅'), RE('0'))).toBe(false); // R ∘ ∅ pode diferir de R
  });
  it('linguagens do Exemplo 1.53 (amostragem complementar)', () => {
    agreesWith(machine('0*10*'), (w) => [...w].filter((c) => c === '1').length === 1);
    agreesWith(machine('Σ*1Σ*'), (w) => w.includes('1'));
    agreesWith(machine('Σ*001Σ*'), (w) => w.includes('001'));
    agreesWith(machine('1*(01⁺)*'), (w) => [...w].every((c, i) => c !== '0' || w[i + 1] === '1'));
    agreesWith(machine('(ΣΣ)*'), (w) => w.length % 2 === 0);
    agreesWith(machine('(ΣΣΣ)*'), (w) => w.length % 3 === 0);
    agreesWith(machine('0Σ*0 ∪ 1Σ*1 ∪ 0 ∪ 1'), (w) => w.length > 0 && w[0] === w[w.length - 1]);
  });
  it('símbolos de vários caracteres: M₅ comparado com uma ER', () => {
    const r = opRegexToNfa('<RESET>', ['RESET', '0', '1', '2']);
    expect(simulateFA(r.machine, 'RESET').status).toBe('accepted');
  });
});

describe('AF → ER (AFNG, Lema 1.60)', () => {
  it('Exemplo 1.66: a*b(a ∪ b)*', () => {
    const m = machine('a*b(a ∪ b)*', ['a', 'b']);
    const dfa = opMinimize(m, 'x').machine; // AFD de 2 estados como na Figura 1.67(a)
    expect(dfa.states).toHaveLength(2);
    const r = opToRegex(dfa, 'Fig 1.67', {});
    expect(r.regex).toBe('a*b(a ∪ b)*');
    expect(r.verified).toBe('equivalent');
  });
  it('Exemplo 1.68: resultado equivalente ao do livro (Figura 1.69(e))', () => {
    const book = '(a(aa ∪ b)*ab ∪ b)((ba ∪ a)(aa ∪ b)*ab ∪ bb)*((ba ∪ a)(aa ∪ b)* ∪ ε) ∪ a(aa ∪ b)*';
    for (const order of ['heuristic', 'listed'] as const) {
      const r = opToRegex(dfa168(), 'Fig 1.69', { order });
      expect(r.verified).toBe('equivalent');
      expect(eq(RE(r.regex, ['a', 'b']), RE(book, ['a', 'b']))).toBe(true);
    }
    expect(eq(M(dfa168()), RE(book, ['a', 'b']))).toBe(true);
  });
  it('todos os exemplos: ER verificada exatamente, com e sem simplificação', () => {
    for (const e of EXAMPLES) {
      for (const simplify of [true, false]) {
        const r = opToRegex(e.machine, e.title, { simplify });
        expect([e.key, simplify, r.verified]).toEqual([e.key, simplify, 'equivalent']);
      }
    }
  });
  it('linguagens ∅ e {ε}', () => {
    expect(opToRegex(ex('empty-language'), 'v', {}).regex).toBe('∅');
    expect(opToRegex(ex('only-epsilon'), 'e', {}).regex).toBe('ε');
  });
});

describe('operações regulares', () => {
  const A = M(ex('ends-01'), 'termina em 01');
  const B = M(ex('even-ones'), 'par de 1s');
  const endsWith01 = (w: string) => w.endsWith('01');
  const evenOnes = (w: string) => [...w].filter((c) => c === '1').length % 2 === 0;
  it('união (Teorema 1.45)', () => {
    const r = opBinary('union', A, B);
    expect(r.machine.kind).toBe('nfa');
    agreesWith(r.machine, (w) => endsWith01(w) || evenOnes(w));
  });
  it('interseção (produto) e diferença', () => {
    const r = opBinary('intersection', A, B);
    expect(r.machine.kind).toBe('dfa');
    expect(validate(r.machine)).toMatchObject({ valid: true, incompleteDfa: false });
    agreesWith(r.machine, (w) => endsWith01(w) && evenOnes(w));
    agreesWith(opBinary('difference', A, B).machine, (w) => endsWith01(w) && !evenOnes(w));
  });
  it('concatenação (Teorema 1.47) e estrela (Teorema 1.49)', () => {
    expect(eq(M(opBinary('concat', RE('0*'), RE('1')).machine), RE('0*1'))).toBe(true);
    expect(eq(M(opStar(RE('01')).machine), RE('(01)*'))).toBe(true);
    // estrela de uma máquina cujo inicial não aceita e tem laços: ε deve entrar, nada mais
    expect(eq(M(opStar(A).machine), RE('ε ∪ Σ*01'))).toBe(true);
  });
  it('complemento de AFN é feito por determinização, não invertendo F', () => {
    const n1 = ex('sipser-n1');
    const c = opComplement(M(n1, 'N1'), ['0', '1']);
    agreesWith(c.machine, (w) => !(w.includes('11') || w.includes('101')));
    // inverter F diretamente no AFN daria outra linguagem:
    const naive = { ...n1, states: n1.states.map((s) => ({ ...s, accepting: !s.accepting })) };
    expect(eq(M(naive), M(c.machine))).toBe(false);
  });
  it('complemento usa o Σ explícito', () => {
    const a = RE('a*', ['a']);
    expect(eq(M(opComplement(a, ['a']).machine), RE('∅', ['a']))).toBe(true);
    expect(eq(M(opComplement(a, ['a', 'b']).machine), RE('Σ*bΣ*', ['a', 'b']))).toBe(true);
    expect(() => opComplement(RE('ab', ['a', 'b']), ['a'])).toThrow(/Faltam/);
  });
  it('A ∪ Ā = Σ* e A ∩ Ā = ∅ (exato)', () => {
    const notA = M(opComplement(A, ['0', '1']).machine, 'não A');
    expect(eq(M(opBinary('union', A, notA).machine), RE('Σ*'))).toBe(true);
    expect(eq(M(opBinary('intersection', A, notA).machine), RE('∅'))).toBe(true);
  });
  it('alfabetos diferentes: Σ = Σ₁ ∪ Σ₂', () => {
    const r = opBinary('union', RE('a*', ['a']), RE('b', ['b']));
    expect(r.machine.alphabet).toEqual(['a', 'b']);
    expect(eq(M(r.machine), RE('a* ∪ b', ['a', 'b']))).toBe(true);
    expect(r.notes.join(' ')).toMatch(/Σ₁ ∪ Σ₂/);
  });
  it('resultados são máquinas válidas do editor', () => {
    for (const op of ['union', 'concat', 'intersection', 'difference'] as const) expect(validate(opBinary(op, A, B).machine).valid).toBe(true);
  });
});

describe('equivalência (Teorema 4.5)', () => {
  it('contraexemplo de comprimento mínimo e quem o aceita', () => {
    const r = opEquivalence(RE('0*10*'), RE('Σ*1Σ*'));
    expect(r.equivalent).toBe(false);
    expect(r.counterexample).toBe('11');
    expect(r.acceptedBy).toBe('Σ*1Σ*');
  });
  it('contraexemplo pode ser ε', () => {
    const r = opEquivalence(RE('0*'), RE('0⁺'));
    expect(r).toMatchObject({ equivalent: false, counterexample: 'ε', acceptedBy: '0*' });
  });
  it('equivalentes: AFN do livro vs AFD mínimo, e notas explicam a prova', () => {
    const r = opEquivalence(M(ex('sipser-n1')), M(opMinimize(ex('sipser-n1'), 'x').machine));
    expect(r.equivalent).toBe(true);
    expect(r.notes.join(' ')).toMatch(/diferença simétrica é vazia/);
  });
  it('alfabetos diferentes são unidos', () => {
    const r = checkEquivalence(toCNFA(machine('a*', ['a'])), toCNFA(machine('a*', ['a', 'b'])));
    expect(r.equivalent).toBe(true);
    expect(r.alphabet).toEqual(['a', 'b']);
  });
  it('máquina inválida é recusada com mensagem', () => {
    const m = ex('ends-01');
    m.initial = null;
    expect(() => opEquivalence(M(m, 'rascunho'), RE('0'))).toThrow(/rascunho/);
  });
});
