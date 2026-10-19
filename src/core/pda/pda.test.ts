import { describe, expect, it } from 'vitest';
import { runBatchPDA } from './batch';
import { PDA_EXAMPLES } from './examples';
import type { PDA } from './model';
import { formatStack, transitionLabel } from './model';
import { explainStep, simulatePDA, PDACancelled } from './simulate';
import { validatePDA } from './validate';

const ex = (k: string) => structuredClone(PDA_EXAMPLES.find((e) => e.key === k)!.machine);

function words(alphabet: string[], n: number): string[] {
  const out = [''];
  let layer = [''];
  for (let i = 0; i < n; i++) out.push(...(layer = layer.flatMap((w) => alphabet.map((a) => w + a))));
  return out;
}

/** Amostragem complementar: confere a linguagem descrita em todas as cadeias até o tamanho n. */
function agrees(m: PDA, pred: (w: string) => boolean, n: number) {
  for (const w of words(m.inputAlphabet, n)) expect([w, simulatePDA(m, w).status]).toEqual([w, pred(w) ? 'accepted' : 'rejected']);
}

describe('exemplos do livro', () => {
  it('todos válidos e com os resultados esperados', () => {
    for (const e of PDA_EXAMPLES) {
      expect([e.key, validatePDA(e.machine).valid]).toEqual([e.key, true]);
      for (const r of runBatchPDA(e.machine, e.tests.filter((t) => t.expected))) expect([e.key, r.input, r.status]).toEqual([e.key, r.input, r.expected]);
    }
  });
  it('aⁿbⁿ (Exemplo 2.14)', () => agrees(ex('anbn'), (w) => /^a*b*$/.test(w) && [...w].filter((c) => c === 'a').length * 2 === w.length, 10));
  it('aⁱbʲcᵏ com i = j ou i = k (Exemplo 2.16)', () =>
    agrees(
      ex('aibjck'),
      (w) => {
        const m = /^(a*)(b*)(c*)$/.exec(w);
        return !!m && (m[1].length === m[2].length || m[1].length === m[3].length);
      },
      7,
    ));
  it('wwᴿ (Exemplo 2.18)', () => agrees(ex('wwr'), (w) => w.length % 2 === 0 && w === [...w].reverse().join(''), 10));
  it('parênteses balanceados por pilha vazia', () =>
    agrees(
      ex('parens-empty'),
      (w) => {
        let d = 0;
        for (const c of w) if ((d += c === '(' ? 1 : -1) < 0) return false;
        return d === 0;
      },
      8,
    ));
});

describe('semântica de aceitação', () => {
  it('não aceita só por passar em estado final antes de consumir a entrada', () => {
    // q1 é de aceitação e é o inicial; "a" deixa a máquina fora de F no fim
    const t = simulatePDA(ex('anbn'), 'a');
    expect(t.status).toBe('rejected');
    expect(t.configs.some((c) => c.state === 's_q1')).toBe(true);
  });
  it('a pilha começa vazia (s0 = ε) e ε é aceita quando q0 ∈ F', () => {
    const t = simulatePDA(ex('anbn'), '');
    expect(t.status).toBe('accepted');
    expect(t.acceptingPath).toEqual([0]);
    expect(t.configs[0].stack).toEqual([]);
  });
  it('estados iguais com pilhas diferentes são configurações diferentes', () => {
    const t = simulatePDA(ex('wwr'), '0110');
    const inQ2 = t.configs.filter((c) => c && c.state === 's_q2');
    const stacks = new Set(inQ2.map((c) => c.stack.join('')));
    expect(stacks.size).toBeGreaterThan(1);
  });
  it('modo pilha vazia é separado: a mesma máquina em modo final (F = ∅) não aceita nada', () => {
    const m = ex('parens-empty');
    expect(simulatePDA(m, '()').status).toBe('accepted');
    expect(simulatePDA({ ...m, acceptance: 'final' }, '()').status).toBe('rejected');
    expect(validatePDA({ ...m, initialStack: [] }).issues.some((i) => i.code === 'pda-empty-mode' && i.severity === 'warning')).toBe(true);
  });
  it('caminho de aceitação começa no inicial, termina com a entrada lida, e explica cada passo', () => {
    const m = ex('anbn');
    const t = simulatePDA(m, 'aabb');
    expect(t.status).toBe('accepted');
    const path = t.acceptingPath!.map((id) => t.configs[id]);
    expect(path[0]).toMatchObject({ state: 's_q1', pos: 0, stack: [] });
    expect(path.at(-1)).toMatchObject({ state: 's_q4', pos: 4 });
    expect(path.map((c) => formatStack(c.stack, m.stackAlphabet))).toEqual(['ε', '$', 'a$', 'aa$', 'a$', '$', 'ε']);
    expect(explainStep(m, path[0], path[1])).toMatch(/empilha \$/);
  });
});

describe('ordem da pilha (Figura 2.23)', () => {
  it('empilhar "xyz" deixa x no topo', () => {
    const m: PDA = {
      kind: 'pda', inputAlphabet: ['a'], stackAlphabet: ['x', 'y', 'z'], acceptance: 'final', initialStack: [], initial: 'p',
      states: [{ id: 'p', name: 'p', x: 0, y: 0, accepting: false }, { id: 'q', name: 'q', x: 0, y: 0, accepting: false }, { id: 'r', name: 'r', x: 0, y: 0, accepting: true }],
      edges: [
        { id: 'e1', from: 'p', to: 'q', transitions: [{ id: 't1', read: null, pop: null, push: ['x', 'y', 'z'] }] },
        { id: 'e2', from: 'q', to: 'r', transitions: [{ id: 't2', read: 'a', pop: 'x', push: [] }] },
      ],
    };
    const t = simulatePDA(m, 'a');
    expect(t.status).toBe('accepted');
    expect(t.configs[t.acceptingPath![1]].stack).toEqual(['x', 'y', 'z']);
    expect(t.configs[t.acceptingPath![2]].stack).toEqual(['y', 'z']);
    expect(validatePDA(m).issues.some((i) => i.code === 'pda-multi-push')).toBe(true);
    expect(transitionLabel(m.edges[0].transitions[0], m.stackAlphabet)).toBe('ε, ε → xyz');
  });
});

describe('limites e cancelamento', () => {
  it('ramo infinito: inconclusivo, nunca rejeitado', () => {
    const m = ex('infinite-branch');
    expect(simulatePDA(m, 'a').status).toBe('accepted');
    const t = simulatePDA(m, 'aa', { maxStack: 50 });
    expect(t.status).toBe('inconclusive');
    expect(t.reason).toMatch(/Não dá para concluir rejeição/);
    const t2 = simulatePDA(m, '', { maxSteps: 30, maxStack: 1000 });
    expect(t2.status).toBe('inconclusive');
    const t3 = simulatePDA(m, '', { maxConfigs: 20, maxStack: 1000 });
    expect(t3.status).toBe('inconclusive');
  });
  it('rejeição exige exploração completa (espaço finito termina)', () => {
    const t = simulatePDA(ex('wwr'), '010');
    expect(t.status).toBe('rejected');
    expect(t.reason).toMatch(/todas as \d+ configurações/);
  });
  it('cancelamento', () => {
    expect(() => simulatePDA(ex('infinite-branch'), 'aa', { maxStack: 1e6, maxSteps: 1e6, maxConfigs: 1e7, shouldCancel: () => true })).toThrow(PDACancelled);
    let n = 0;
    const r = runBatchPDA(ex('anbn'), [{ input: 'ab' }, { input: 'aabb' }, { input: 'b' }], { shouldCancelBatch: () => ++n > 1 });
    expect(r.map((x) => x.status)).toEqual(['accepted', 'interrupted', 'interrupted']);
  });
});

describe('validação', () => {
  it('símbolos fora de Σ e Γ, estado inicial ausente, transições repetidas', () => {
    const m = ex('anbn');
    m.edges[1].transitions.push({ id: 'z1', read: 'c', pop: 'w', push: ['k'] }, { id: 'z2', read: 'a', pop: null, push: ['a'] });
    const codes = validatePDA(m).issues.map((i) => `${i.severity}:${i.code}`);
    expect(codes.filter((c) => c === 'error:symbol-not-in-alphabet')).toHaveLength(3);
    expect(codes).toContain('warning:duplicate-transition');
    expect(validatePDA({ ...m, initial: null }).valid).toBe(false);
  });
  it('entrada com símbolo fora de Σ é inválida', () => {
    expect(simulatePDA(ex('anbn'), 'abc')).toMatchObject({ status: 'invalid', errorPosition: 2 });
  });
});
