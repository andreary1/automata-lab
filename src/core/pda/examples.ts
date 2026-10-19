import type { BatchCase } from '../fa/batch';
import type { PDA, PDAAcceptance } from './model';

export interface PDAExample {
  key: string;
  title: string;
  language: string;
  description: string;
  source?: string;
  machine: PDA;
  tests: BatchCase[];
}

type S = [name: string, x: number, y: number, accepting?: boolean];
/** Transições no formato do livro: "a,b→c" (ε permitido); várias separadas por ";". */
type T = [from: string, to: string, labels: string];

function sym(s: string): string | null {
  const t = s.trim();
  return t === 'ε' ? null : t;
}

function build(sigma: string[], gamma: string[], states: S[], initial: string, trans: T[], opts: { acceptance?: PDAAcceptance; initialStack?: string[] } = {}): PDA {
  const id = (n: string) => `s_${n}`;
  return {
    kind: 'pda',
    inputAlphabet: sigma,
    stackAlphabet: gamma,
    acceptance: opts.acceptance ?? 'final',
    initialStack: opts.initialStack ?? [],
    states: states.map(([name, x, y, acc]) => ({ id: id(name), name, x, y, accepting: !!acc })),
    initial: id(initial),
    edges: trans.map(([f, t, labels], i) => ({
      id: `e_${i}`,
      from: id(f),
      to: id(t),
      transitions: labels.split(';').map((l, j) => {
        const [lhs, rhs] = l.split('→');
        const [read, pop] = lhs.split(',');
        const push = rhs.trim() === 'ε' ? [] : [...rhs.trim()];
        return { id: `t_${i}_${j}`, read: sym(read), pop: sym(pop), push };
      }),
    })),
  };
}

const A = (input: string): BatchCase => ({ input, expected: 'accepted' });
const R = (input: string): BatchCase => ({ input, expected: 'rejected' });

export const PDA_EXAMPLES: PDAExample[] = [
  {
    key: 'anbn',
    title: 'aⁿbⁿ',
    language: '{ aⁿbⁿ | n ≥ 0 }',
    description: 'Empilha $ para marcar o fundo, empilha um a para cada a lido e desempilha um a para cada b. Aceita ao ver $ de novo com a entrada toda lida. É o AP M₁ do livro com a e b no lugar de 0 e 1.',
    source: 'Sipser, Exemplo 2.14 e Figura 2.15 (p. 117–118), com a/b no lugar de 0/1',
    machine: build(['a', 'b'], ['a', '$'], [['q1', 100, 140, true], ['q2', 300, 140], ['q3', 300, 320], ['q4', 100, 320, true]], 'q1', [
      ['q1', 'q2', 'ε,ε→$'],
      ['q2', 'q2', 'a,ε→a'],
      ['q2', 'q3', 'b,a→ε'],
      ['q3', 'q3', 'b,a→ε'],
      ['q3', 'q4', 'ε,$→ε'],
    ]),
    tests: [A(''), A('ab'), A('aabb'), A('aaabbb'), R('a'), R('b'), R('aab'), R('abb'), R('ba'), R('abab')],
  },
  {
    key: 'aibjck',
    title: 'aⁱbʲcᵏ com i = j ou i = k',
    language: '{ aⁱbʲcᵏ | i, j, k ≥ 0 e i = j ou i = k }',
    description: 'O não determinismo escolhe se os as serão casados com os bs (ramo de cima) ou com os cs (ramo de baixo). O livro observa que o não determinismo é essencial aqui.',
    source: 'Sipser, Exemplo 2.16 e Figura 2.17 (p. 118–119)',
    machine: build(['a', 'b', 'c'], ['a', '$'], [['q1', 80, 80], ['q2', 200, 240], ['q3', 340, 100], ['q4', 500, 100, true], ['q5', 360, 260], ['q6', 500, 260], ['q7', 640, 260, true]], 'q1', [
      ['q1', 'q2', 'ε,ε→$'],
      ['q2', 'q2', 'a,ε→a'],
      ['q2', 'q3', 'ε,ε→ε'],
      ['q3', 'q3', 'b,a→ε'],
      ['q3', 'q4', 'ε,$→ε'],
      ['q4', 'q4', 'c,ε→ε'],
      ['q2', 'q5', 'ε,ε→ε'],
      ['q5', 'q5', 'b,ε→ε'],
      ['q5', 'q6', 'ε,ε→ε'],
      ['q6', 'q6', 'c,a→ε'],
      ['q6', 'q7', 'ε,$→ε'],
    ]),
    tests: [A(''), A('abc'), A('aabbc'), A('aabcc'), A('bb'), A('cc'), A('abbbc'), R('abbbcc'), R('bbccc'), R('aabc'), R('abbcc'), R('ba'), R('cab')],
  },
  {
    key: 'wwr',
    title: 'wwᴿ (palíndromos pares)',
    language: '{ wwᴿ | w ∈ {0,1}* }',
    description: 'Empilha a primeira metade e "adivinha" o meio com uma transição ε; depois desempilha conferindo cada símbolo. Na simulação, veja várias configurações no mesmo estado com pilhas diferentes.',
    source: 'Sipser, Exemplo 2.18 e Figura 2.19 (p. 119)',
    machine: build(['0', '1'], ['0', '1', '$'], [['q1', 100, 140, true], ['q2', 300, 140], ['q3', 300, 320], ['q4', 100, 320, true]], 'q1', [
      ['q1', 'q2', 'ε,ε→$'],
      ['q2', 'q2', '0,ε→0;1,ε→1'],
      ['q2', 'q3', 'ε,ε→ε'],
      ['q3', 'q3', '0,0→ε;1,1→ε'],
      ['q3', 'q4', 'ε,$→ε'],
    ]),
    tests: [A(''), A('00'), A('0110'), A('1001'), A('011110'), R('0'), R('01'), R('010'), R('0111')],
  },
  {
    key: 'parens-empty',
    title: 'Parênteses balanceados (pilha vazia)',
    language: '{ w ∈ {(, )}* | w é balanceada }',
    description: 'Exemplo do modo de aceitação por PILHA VAZIA (não é o padrão do livro). A pilha começa com Z; um único estado empilha ( e desempilha ao ler ); a transição ε, Z → ε esvazia a pilha.',
    machine: build(['(', ')'], ['(', 'Z'], [['q', 220, 200]], 'q', [['q', 'q', '(,ε→(;),(→ε;ε,Z→ε']], { acceptance: 'empty', initialStack: ['Z'] }),
    tests: [A(''), A('()'), A('(())'), A('()()'), R('('), R(')'), R(')('), R('(()')],
  },
  {
    key: 'infinite-branch',
    title: 'Ramo infinito (limite)',
    language: '{ a }',
    description: 'O laço ε, ε → x empilha para sempre. Para cadeias fora da linguagem, a busca nunca esgota as configurações: o resultado é INCONCLUSIVO por limite, nunca "rejeitada". Para "a", um ramo aceita e a resposta é imediata.',
    machine: build(['a'], ['x'], [['q0', 140, 200], ['q1', 360, 200, true]], 'q0', [['q0', 'q0', 'ε,ε→x'], ['q0', 'q1', 'a,ε→ε']]),
    tests: [A('a'), { input: 'aa' }, { input: '' }],
  },
];
