import type { BatchCase } from '../fa/batch';
import type { TM, TMTransition } from './model';

export interface TMExample {
  key: string;
  title: string;
  language: string;
  description: string;
  source?: string;
  machine: TM;
  tests: BatchCase[];
}

type S = [name: string, x: number, y: number];
/**
 * Transições no formato do livro, separadas por ";":
 *  "0→x,D" (lê 0, escreve x, move para a direita), "0,1→E" (lê 0 ou 1, não altera, move para a esquerda).
 */
type T = [from: string, to: string, labels: string];

function parseLabels(labels: string, i: number): TMTransition[] {
  const out: TMTransition[] = [];
  labels.split(';').forEach((l, j) => {
    const [lhs, rhs] = l.split('→');
    const parts = rhs.split(',').map((x) => x.trim());
    const move = parts[parts.length - 1] === 'E' ? 'L' : 'R';
    const write = parts.length > 1 ? parts[0] : null;
    lhs.split(',').forEach((r, k) => {
      const read = r.trim();
      out.push({ id: `t_${i}_${j}_${k}`, read, write: write ?? read, move });
    });
  });
  return out;
}

function build(sigma: string[], extra: string[], states: S[], initial: string, accept: string, reject: string | null, trans: T[]): TM {
  const id = (n: string) => `s_${n}`;
  return {
    kind: 'tm',
    inputAlphabet: sigma,
    tapeSymbols: extra,
    states: states.map(([name, x, y]) => ({ id: id(name), name, x, y, accepting: false })),
    initial: id(initial),
    acceptState: id(accept),
    rejectState: reject ? id(reject) : null,
    edges: trans.map(([f, t, labels], i) => ({ id: `e_${i}`, from: id(f), to: id(t), transitions: parseLabels(labels, i) })),
  };
}

const A = (input: string): BatchCase => ({ input, expected: 'accepted' });
const R = (input: string): BatchCase => ({ input, expected: 'rejected' });

export const TM_EXAMPLES: TMExample[] = [
  {
    key: 'sipser-m2',
    title: 'M₂: 0 elevado a potência de 2',
    language: '{ 0^(2ⁿ) | n ≥ 0 }',
    description: 'Corta metade dos 0s a cada passagem; aceita se sobrar exatamente um. Decisor: para em toda entrada.',
    source: 'Sipser, Exemplo 3.7 e Figura 3.8',
    machine: build(
      ['0'],
      ['x'],
      [['q1', 100, 200], ['q2', 280, 200], ['q3', 460, 200], ['q4', 640, 200], ['q5', 460, 40], ['qaceita', 280, 40], ['qrejeita', 370, 400]],
      'q1',
      'qaceita',
      'qrejeita',
      [
        ['q1', 'q2', '0→⊔,D'],
        ['q1', 'qrejeita', '⊔→D;x→D'],
        ['q2', 'q2', 'x→D'],
        ['q2', 'qaceita', '⊔→D'],
        ['q2', 'q3', '0→x,D'],
        ['q3', 'q3', 'x→D'],
        ['q3', 'q4', '0→D'],
        ['q3', 'q5', '⊔→E'],
        ['q4', 'q4', 'x→D'],
        ['q4', 'q3', '0→x,D'],
        ['q4', 'qrejeita', '⊔→D'],
        ['q5', 'q5', '0,x→E'],
        ['q5', 'q2', '⊔→D'],
      ],
    ),
    tests: [R(''), A('0'), A('00'), R('000'), A('0000'), R('000000'), A('00000000'), R('0000000')],
  },
  {
    key: 'sipser-m1',
    title: 'M₁: w#w',
    language: '{ w#w | w ∈ {0,1}* }',
    description: 'Zigue-zague: marca um símbolo à esquerda de #, confere o correspondente à direita, volta. q_rejeita é implícito, como na figura.',
    source: 'Sipser, Exemplo 3.9 e Figura 3.10',
    machine: build(
      ['0', '1', '#'],
      ['x'],
      [['q1', 100, 220], ['q2', 280, 90], ['q3', 280, 350], ['q4', 480, 90], ['q5', 480, 350], ['q6', 640, 220], ['q7', 370, 220], ['q8', 100, 400], ['qaceita', 300, 480]],
      'q1',
      'qaceita',
      null,
      [
        ['q1', 'q2', '0→x,D'],
        ['q1', 'q3', '1→x,D'],
        ['q1', 'q8', '#→D'],
        ['q2', 'q2', '0,1→D'],
        ['q2', 'q4', '#→D'],
        ['q3', 'q3', '0,1→D'],
        ['q3', 'q5', '#→D'],
        ['q4', 'q4', 'x→D'],
        ['q4', 'q6', '0→x,E'],
        ['q5', 'q5', 'x→D'],
        ['q5', 'q6', '1→x,E'],
        ['q6', 'q6', '0,1,x→E'],
        ['q6', 'q7', '#→E'],
        ['q7', 'q7', '0,1→E'],
        ['q7', 'q1', 'x→D'],
        ['q8', 'q8', 'x→D'],
        ['q8', 'qaceita', '⊔→D'],
      ],
    ),
    tests: [A('#'), A('0#0'), A('011000#011000'), A('10#10'), R(''), R('0#1'), R('01#0'), R('0#01'), R('00'), R('0##0')],
  },
  {
    key: 'invert-bits',
    title: 'Inverter bits (transdutor)',
    language: 'Σ* (aceita tudo; a saída fica na fita)',
    description: 'Troca cada 0 por 1 e cada 1 por 0 e aceita no primeiro branco. Mostra a MT calculando, não só decidindo.',
    source: 'Exemplo do app (não está no livro)',
    machine: build(['0', '1'], [], [['q0', 140, 180], ['qaceita', 360, 180]], 'q0', 'qaceita', null, [
      ['q0', 'q0', '0→1,D;1→0,D'],
      ['q0', 'qaceita', '⊔→E'],
    ]),
    tests: [A(''), A('0'), A('1011'), A('000111')],
  },
  {
    key: 'search-one',
    title: 'Procura um 1 (reconhecedor)',
    language: '{ w ∈ {0,1}* | w contém 1 }',
    description: 'Anda para a direita até achar um 1. Se não houver 1, anda para sempre pelos brancos: o app só pode dizer "inconclusiva" ao atingir o limite de passos.',
    source: 'Exemplo do app (ilustra a Definição 3.5 × 3.6)',
    machine: build(['0', '1'], [], [['q0', 140, 180], ['qaceita', 360, 180]], 'q0', 'qaceita', null, [
      ['q0', 'q0', '0,⊔→D'],
      ['q0', 'qaceita', '1→D'],
    ]),
    tests: [A('1'), A('0001'), A('0100'), R(''), R('000')],
  },
  {
    key: 'ping-pong',
    title: 'Vai e volta (laço provado)',
    language: '{ ε }',
    description: 'Com entrada não vazia, o cabeçote vai e volta entre duas células e a configuração se repete: o app prova que a máquina não para.',
    source: 'Exemplo do app',
    machine: build(['a'], [], [['q0', 140, 180], ['q1', 360, 180], ['qaceita', 140, 360]], 'q0', 'qaceita', null, [
      ['q0', 'q1', 'a→D'],
      ['q1', 'q0', 'a,⊔→E'],
      ['q0', 'qaceita', '⊔→D'],
    ]),
    tests: [A(''), R('a'), R('aa'), R('aaa')],
  },
];
