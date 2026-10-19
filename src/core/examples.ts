import type { BatchCase } from './fa/batch';
import type { FAKind, FiniteAutomaton } from './fa/model';

/**
 * Exemplos didáticos. Os marcados com `source` reproduzem máquinas do livro
 * (Sipser, Introdução à Teoria da Computação, trad. bras.) — a referência indica
 * figura/exemplo verificados visualmente no PDF. Os demais são exemplos do app.
 */
export interface Example {
  key: string;
  title: string;
  language: string;
  description: string;
  source?: string;
  machine: FiniteAutomaton;
  tests: BatchCase[];
}

type S = [name: string, x: number, y: number, accepting?: boolean];
type T = [from: string, to: string, labels: string];

/** labels: símbolos separados por vírgula; "ε" marca transição vazia. */
function build(kind: FAKind, alphabet: string[], states: S[], initial: string, trans: T[]): FiniteAutomaton {
  const id = (n: string) => `s_${n}`;
  return {
    kind,
    alphabet,
    states: states.map(([name, x, y, acc]) => ({ id: id(name), name, x, y, accepting: !!acc })),
    initial: id(initial),
    edges: trans.map(([f, t, labels], i) => {
      const parts = labels.split(',').map((s) => s.trim());
      return { id: `e_${i}`, from: id(f), to: id(t), symbols: parts.filter((p) => p !== 'ε'), epsilon: parts.includes('ε') };
    }),
  };
}

const A = (input: string): BatchCase => ({ input, expected: 'accepted' });
const R = (input: string): BatchCase => ({ input, expected: 'rejected' });

export const EXAMPLES: Example[] = [
  {
    key: 'ends-01',
    title: 'Termina em 01',
    language: '{ w ∈ {0,1}* | w termina em 01 }',
    description: 'AFD completo de 3 estados: A = "nada útil", B = "acabou de ler 0", C = "acabou de ler 01".',
    machine: build('dfa', ['0', '1'], [['A', 100, 240], ['B', 290, 120], ['C', 480, 240, true]], 'A', [
      ['A', 'B', '0'], ['A', 'A', '1'], ['B', 'B', '0'], ['B', 'C', '1'], ['C', 'B', '0'], ['C', 'A', '1'],
    ]),
    tests: [R(''), A('01'), A('1101'), A('001'), R('0'), R('10'), R('011'), A('0101')],
  },
  {
    key: 'even-ones',
    title: 'Quantidade par de 1s',
    language: '{ w ∈ {0,1}* | w contém um número par de 1s }',
    description: 'AFD de paridade. Como 0 é par, ε é aceita.',
    machine: build('dfa', ['0', '1'], [['par', 140, 200, true], ['ímpar', 360, 200]], 'par', [
      ['par', 'par', '0'], ['par', 'ímpar', '1'], ['ímpar', 'par', '1'], ['ímpar', 'ímpar', '0'],
    ]),
    tests: [A(''), R('1'), A('11'), A('0101'), R('111'), A('000')],
  },
  {
    key: 'sipser-m1',
    title: 'M₁ do livro',
    language: '{ w | w contém pelo menos um 1 e um número par de 0s segue o último 1 }',
    description: 'O primeiro AFD do capítulo 1, com descrição formal completa no livro.',
    source: 'Sipser, Figura 1.6 (p. 36) e descrição formal (p. 36–37)',
    machine: build('dfa', ['0', '1'], [['q1', 100, 200], ['q2', 280, 200, true], ['q3', 460, 200]], 'q1', [
      ['q1', 'q1', '0'], ['q1', 'q2', '1'], ['q2', 'q2', '1'], ['q2', 'q3', '0'], ['q3', 'q2', '0,1'],
    ]),
    tests: [A('1'), A('01'), A('11'), A('100'), A('0101010101'), R('0'), R('10'), R('101000'), R('')],
  },
  {
    key: 'sipser-n1',
    title: 'N₁ (AFN com ε)',
    language: '{ w ∈ {0,1}* | w contém 101 ou 11 como subcadeia }',
    description: 'AFN do livro com transição ε de q2 para q3. Compare a árvore de computação de 010110 com a simulação passo a passo.',
    source: 'Sipser, Figura 1.27 (p. 48), Exemplo 1.38 (p. 55) e Figura 1.29 (p. 50)',
    machine: build('nfa', ['0', '1'], [['q1', 100, 200], ['q2', 260, 200], ['q3', 420, 200], ['q4', 580, 200, true]], 'q1', [
      ['q1', 'q1', '0,1'], ['q1', 'q2', '1'], ['q2', 'q3', '0,ε'], ['q3', 'q4', '1'], ['q4', 'q4', '0,1'],
    ]),
    tests: [A('010110'), A('11'), A('101'), R(''), R('0'), R('100'), R('0100')],
  },
  {
    key: 'sipser-n4',
    title: 'N₄ (AFN com ε)',
    language: 'Linguagem de N₄ sobre {a, b}',
    description: 'O livro afirma que N₄ aceita ε, a, baba e baa, e não aceita b, bb e babba. Usado depois para ilustrar AFN → AFD.',
    source: 'Sipser, Exemplo 1.35 e Figura 1.36 (p. 54)',
    machine: build('nfa', ['a', 'b'], [['q1', 260, 110, true], ['q2', 140, 300], ['q3', 380, 300]], 'q1', [
      ['q1', 'q2', 'b'], ['q1', 'q3', 'ε'], ['q2', 'q2', 'a'], ['q2', 'q3', 'a,b'], ['q3', 'q1', 'a'],
    ]),
    tests: [A(''), A('a'), A('baba'), A('baa'), R('b'), R('bb'), R('babba')],
  },
  {
    key: 'eps-cycle',
    title: 'Ciclo de ε',
    language: '{ a }',
    description: 'q0 → q1 → q2 → q0 por ε forma um ciclo. O fecho-ε é calculado com conjunto de visitados, sem repetição infinita.',
    machine: build('nfa', ['a'], [['q0', 120, 200], ['q1', 280, 90], ['q2', 280, 310], ['q3', 460, 310, true]], 'q0', [
      ['q0', 'q1', 'ε'], ['q1', 'q2', 'ε'], ['q2', 'q0', 'ε'], ['q2', 'q3', 'a'],
    ]),
    tests: [R(''), A('a'), R('aa')],
  },
  {
    key: 'empty-language',
    title: 'Linguagem vazia ∅',
    language: '∅',
    description: 'F = ∅: nenhuma cadeia é aceita, nem ε. Não confunda ∅ (nenhuma cadeia) com {ε} (só a palavra vazia).',
    machine: build('dfa', ['0', '1'], [['q0', 200, 200]], 'q0', [['q0', 'q0', '0,1']]),
    tests: [R(''), R('0'), R('1'), R('0110')],
  },
  {
    key: 'only-epsilon',
    title: 'Apenas ε',
    language: '{ ε }',
    description: 'O estado inicial é de aceitação e qualquer símbolo leva ao poço.',
    machine: build('dfa', ['0', '1'], [['q0', 140, 200, true], ['poço', 360, 200]], 'q0', [['q0', 'poço', '0,1'], ['poço', 'poço', '0,1']]),
    tests: [A(''), R('0'), R('1'), R('00')],
  },
  {
    key: 'sipser-m5',
    title: 'M₅ (símbolo RESET)',
    language: '{ w | a soma dos símbolos é 0 módulo 3, com RESET zerando o contador }',
    description: 'Alfabeto com símbolo de vários caracteres: escreva a entrada com símbolos separados por espaço, ex.: "1 0 RESET 2".',
    source: 'Sipser, Exemplo 1.13 e Figura 1.14 (p. 39–40); cadeia do Exemplo 1.17 (p. 41)',
    machine: build('dfa', ['RESET', '0', '1', '2'], [['q0', 140, 300, true], ['q1', 300, 110], ['q2', 460, 300]], 'q0', [
      ['q0', 'q0', '0,RESET'], ['q0', 'q1', '1'], ['q0', 'q2', '2'],
      ['q1', 'q1', '0'], ['q1', 'q2', '1'], ['q1', 'q0', '2,RESET'],
      ['q2', 'q2', '0'], ['q2', 'q0', '1,RESET'], ['q2', 'q1', '2'],
    ]),
    tests: [A('1 0 RESET 2 2 RESET 0 1 2'), A(''), R('1'), A('1 2'), A('2 RESET')],
  },
];
