import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { runBatch } from './batch';
import { buildDelta, epsilonClosure, reachableStates } from './delta';
import { completeWithSink, deleteStates, updateState } from './edit';
import { autoLayout } from './layout';
import type { FiniteAutomaton } from './model';
import { simulateFA } from './simulate';
import { parseAlphabetText, symbolProblem, tokenize } from './symbols';
import { transitionTable } from './table';
import { validate } from './validate';

const ex = (k: string) => structuredClone(EXAMPLES.find((e) => e.key === k)!.machine);

/** Gera todas as cadeias sobre Σ até tamanho n (teste complementar, NÃO é prova). */
function allWords(alphabet: string[], n: number): string[][] {
  const out: string[][] = [[]];
  let layer: string[][] = [[]];
  for (let i = 0; i < n; i++) {
    layer = layer.flatMap((w) => alphabet.map((a) => [...w, a]));
    out.push(...layer);
  }
  return out;
}
const join = (m: FiniteAutomaton, w: string[]) => (m.alphabet.some((a) => a.length > 1) ? w.join(' ') : w.join(''));

describe('exemplos: aceitação e rejeição esperadas', () => {
  for (const e of EXAMPLES) {
    it(`${e.title}`, () => {
      expect(validate(e.machine).valid).toBe(true);
      const res = runBatch(e.machine, e.tests);
      for (const r of res) expect({ input: r.input, status: r.status }).toEqual({ input: r.input, status: r.expected });
    });
  }

  it('linguagens descritas conferem por enumeração limitada (complementar, não prova)', () => {
    const checks: Record<string, (w: string) => boolean> = {
      'ends-01': (w) => w.endsWith('01'),
      'even-ones': (w) => [...w].filter((c) => c === '1').length % 2 === 0,
      'sipser-m1': (w) => w.includes('1') && (w.length - 1 - w.lastIndexOf('1')) % 2 === 0,
      'sipser-n1': (w) => w.includes('101') || w.includes('11'),
      'empty-language': () => false,
      'only-epsilon': (w) => w === '',
    };
    for (const [k, pred] of Object.entries(checks)) {
      const m = ex(k);
      for (const w of allWords(m.alphabet, 8)) {
        const s = join(m, w);
        expect([k, s, simulateFA(m, s).status]).toEqual([k, s, pred(s) ? 'accepted' : 'rejected']);
      }
    }
  });
});

describe('palavra vazia', () => {
  it('campo vazio e "ε" denotam a palavra vazia', () => {
    expect(tokenize('', ['0'])).toEqual({ ok: true, tokens: [] });
    expect(tokenize('ε', ['0'])).toEqual({ ok: true, tokens: [] });
    expect(tokenize('   ', ['0'])).toEqual({ ok: true, tokens: [] });
  });
  it('ε é aceita sse E({q0}) ∩ F ≠ ∅', () => {
    expect(simulateFA(ex('only-epsilon'), '').status).toBe('accepted');
    expect(simulateFA(ex('empty-language'), '').status).toBe('rejected');
    expect(simulateFA(ex('sipser-n4'), '').status).toBe('accepted'); // q1 ∈ F
    // aceitação de ε via fecho-ε: q0 -ε-> q1 (aceitação)
    const m: FiniteAutomaton = {
      kind: 'nfa', alphabet: ['a'], initial: 'x',
      states: [{ id: 'x', name: 'x', x: 0, y: 0, accepting: false }, { id: 'y', name: 'y', x: 0, y: 0, accepting: true }],
      edges: [{ id: 'e', from: 'x', to: 'y', symbols: [], epsilon: true }],
    };
    const t = simulateFA(m, '');
    expect(t.status).toBe('accepted');
    expect(t.steps[0].active.sort()).toEqual(['x', 'y']);
    expect(t.steps[0].epsilonEdges).toEqual(['e']);
  });
});

describe('símbolos fora do alfabeto e tokenização', () => {
  it('rejeita como entrada inválida, com posição', () => {
    const t = simulateFA(ex('ends-01'), '0120');
    expect(t.status).toBe('invalid');
    expect(t.errorPosition).toBe(2);
    expect(t.reason).toMatch(/"2"/);
  });
  it('ε no meio da cadeia é inválido', () => {
    expect(tokenize('0ε1', ['0', '1']).ok).toBe(false);
  });
  it('alfabeto com símbolos de vários caracteres exige separação por espaço', () => {
    const sigma = ['RESET', '0', '1', '2'];
    expect(tokenize('1 0 RESET 2', sigma)).toEqual({ ok: true, tokens: ['1', '0', 'RESET', '2'] });
    expect(tokenize('10RESET2', sigma).ok).toBe(false);
  });
  it('espaços são ignorados em alfabetos de um caractere', () => {
    expect(tokenize('0 1 1', ['0', '1'])).toEqual({ ok: true, tokens: ['0', '1', '1'] });
  });
  it('símbolos reservados e inválidos', () => {
    expect(symbolProblem('ε')).not.toBeNull();
    expect(symbolProblem('∅')).not.toBeNull();
    expect(symbolProblem('a b')).not.toBeNull();
    expect(symbolProblem('a,b')).not.toBeNull();
    expect(symbolProblem('')).not.toBeNull();
    expect(symbolProblem('RESET')).toBeNull();
    expect(parseAlphabetText('0, 1 1 ε')).toEqual({ symbols: ['0', '1'], errors: [expect.stringContaining('ε')] });
  });
});

describe('fecho-ε e ciclos ε', () => {
  it('termina em ciclos e inclui todos os estados do ciclo', () => {
    const m = ex('eps-cycle');
    const d = buildDelta(m);
    const c = epsilonClosure(d, [m.initial!]);
    expect(c.states.size).toBe(3);
    expect(c.usedEdges.size).toBe(3);
  });
  it('fecho aplicado após cada símbolo (N1 do livro, entrada 010110)', () => {
    const m = ex('sipser-n1');
    const t = simulateFA(m, '010110');
    expect(t.status).toBe('accepted');
    const name = (id: string) => m.states.find((s) => s.id === id)!.name;
    const sets = t.steps.map((s) => s.active.map(name).sort().join(','));
    // Após "01": {q1, q2, q3} (q3 vem do fecho-ε de q2) — coerente com a Figura 1.29.
    expect(sets[2]).toBe('q1,q2,q3');
    expect(sets[6]).toBe('q1,q3,q4');
  });
  it('a cadeia "aa" no ciclo ε é rejeitada', () => {
    const t = simulateFA(ex('eps-cycle'), 'aa');
    expect(t.status).toBe('rejected');
    expect(t.processed).toBe(2);
  });
});

describe('estados inalcançáveis', () => {
  it('são apontados como informação e não alteram a linguagem', () => {
    const m = ex('ends-01');
    m.states.push({ id: 'z', name: 'Z', x: 0, y: 0, accepting: true });
    m.edges.push({ id: 'ez', from: 'z', to: 'z', symbols: ['0', '1'], epsilon: false });
    expect(reachableStates(m).has('z')).toBe(false);
    const r = validate(m);
    expect(r.valid).toBe(true);
    expect(r.issues.find((i) => i.code === 'unreachable')?.stateIds).toEqual(['z']);
    expect(simulateFA(m, '11').status).toBe('rejected');
  });
});

describe('AFD: transições ausentes, conflitantes e ε', () => {
  it('ausente: aviso, simulação com poço implícito e completar com poço preserva a linguagem', () => {
    const m = ex('ends-01');
    m.edges = m.edges.filter((e) => !(e.from === 's_C' && e.to === 's_A'));
    const r = validate(m);
    expect(r.valid).toBe(true);
    expect(r.incompleteDfa).toBe(true);
    expect(r.issues.some((i) => i.code === 'dfa-missing')).toBe(true);
    const t = simulateFA(m, '011');
    expect(t.status).toBe('rejected');
    expect(t.processed).toBe(3);
    const { machine: full, sinkId } = completeWithSink(m);
    expect(sinkId).not.toBeNull();
    expect(validate(full).incompleteDfa).toBe(false);
    expect(validate(full).issues.some((i) => i.code === 'dfa-missing')).toBe(false);
    for (const w of allWords(['0', '1'], 7)) expect(simulateFA(full, w.join('')).status).toBe(simulateFA(m, w.join('')).status);
  });
  it('completar com poço não altera a máquina original (sem mutação silenciosa)', () => {
    const m = ex('ends-01');
    m.edges.pop();
    const before = JSON.stringify(m);
    completeWithSink(m);
    expect(JSON.stringify(m)).toBe(before);
  });
  it('conflito: erro e máquina inválida para simulação', () => {
    const m = ex('ends-01');
    m.edges.find((e) => e.from === 's_A' && e.to === 's_A')!.symbols.push('0'); // δ(A,0) ∈ {A, B}
    const r = validate(m);
    expect(r.valid).toBe(false);
    expect(r.issues.find((i) => i.code === 'dfa-conflict')).toBeTruthy();
    expect(simulateFA(m, '0').status).toBe('invalid');
    const table = transitionTable(m);
    expect(table.rows[0].cells[0].problem).toBe('conflict');
    // A mesma máquina como AFN é válida e não determinística.
    expect(validate({ ...m, kind: 'nfa' }).valid).toBe(true);
  });
  it('ε em AFD é erro', () => {
    const m = ex('ends-01');
    m.edges[0].epsilon = true;
    expect(validate(m).issues.some((i) => i.code === 'dfa-epsilon' && i.severity === 'error')).toBe(true);
  });
  it('sem estado inicial e nomes duplicados são erros', () => {
    const m = ex('ends-01');
    expect(validate({ ...m, initial: null }).valid).toBe(false);
    const dup = updateState(m, 's_B', { name: 'A' });
    expect(validate(dup).issues.some((i) => i.code === 'duplicate-name')).toBe(true);
  });
  it('símbolo fora de Σ numa transição é erro', () => {
    const m = ex('ends-01');
    m.edges[0].symbols.push('x');
    expect(validate(m).issues.some((i) => i.code === 'symbol-not-in-alphabet')).toBe(true);
  });
  it('excluir o estado inicial remove suas transições e zera q0', () => {
    const m = deleteStates(ex('ends-01'), new Set(['s_A']));
    expect(m.initial).toBeNull();
    expect(m.edges.every((e) => e.from !== 's_A' && e.to !== 's_A')).toBe(true);
  });
  it('renomear estados não quebra transições (ids estáveis)', () => {
    const m = updateState(ex('ends-01'), 's_C', { name: 'fim' });
    expect(simulateFA(m, '1101').status).toBe('accepted');
    expect(transitionTable(m).rows.find((r) => r.name === 'fim')).toBeTruthy();
  });
});

describe('simulação passo a passo', () => {
  it('AFD tem exatamente um estado ativo por passo e destaca a transição usada', () => {
    const m = ex('sipser-m1');
    const t = simulateFA(m, '1101');
    expect(t.steps).toHaveLength(5);
    for (const s of t.steps) expect(s.active).toHaveLength(1);
    expect(t.steps.slice(1).every((s) => s.symbolEdges.length === 1)).toBe(true);
    const names = t.steps.map((s) => m.states.find((x) => x.id === s.active[0])!.name);
    expect(names).toEqual(['q1', 'q2', 'q2', 'q3', 'q2']);
  });
  it('AFN: ramos morrem e a explicação diz por quê', () => {
    const m = ex('sipser-n4');
    const t = simulateFA(m, 'bbb');
    expect(t.status).toBe('rejected');
    expect(t.reason).toMatch(/nenhum ramo/);
  });
  it('M5 do livro aceita a cadeia do Exemplo 1.17', () => {
    const m = ex('sipser-m5');
    const t = simulateFA(m, '1 0 RESET 2 2 RESET 0 1 2');
    expect(t.status).toBe('accepted');
    const names = t.steps.map((s) => m.states.find((x) => x.id === s.active[0])!.name);
    expect(names).toEqual(['q0', 'q1', 'q1', 'q0', 'q2', 'q1', 'q0', 'q0', 'q1', 'q0']);
  });
});

describe('limites de execução e cancelamento', () => {
  it('limite de passos gera resultado inconclusivo (não rejeição)', () => {
    const t = simulateFA(ex('even-ones'), '1'.repeat(50), { maxSteps: 10 });
    expect(t.status).toBe('inconclusive');
    expect(t.processed).toBe(10);
    expect(t.reason).toMatch(/não indica rejeição/);
  });
  it('lote cancelado marca as cadeias restantes como interrompidas', () => {
    let calls = 0;
    const res = runBatch(ex('even-ones'), ['1', '11', '111', '1111'].map((input) => ({ input })), { shouldCancel: () => ++calls > 2 });
    expect(res.map((r) => r.status)).toEqual(['rejected', 'accepted', 'interrupted', 'interrupted']);
  });
  it('lote informa quantidade de passos e conferência com o esperado', () => {
    const res = runBatch(ex('ends-01'), [{ input: '0101', expected: 'accepted' }, { input: '0', expected: 'accepted' }, { input: '2' }]);
    expect(res[0]).toMatchObject({ status: 'accepted', steps: 4, matches: true });
    expect(res[1]).toMatchObject({ status: 'rejected', steps: 1, matches: false });
    expect(res[2]).toMatchObject({ status: 'invalid' });
  });
});

describe('layout e tabela', () => {
  it('layout posiciona todos os estados, inclusive inalcançáveis', () => {
    const m = ex('sipser-n1');
    m.states.push({ id: 'z', name: 'z', x: 0, y: 0, accepting: false });
    const pos = autoLayout(m);
    expect(pos.size).toBe(m.states.length);
    expect(pos.get(m.initial!)!.x).toBeLessThan(pos.get('z')!.x);
  });
  it('tabela do AFN inclui coluna ε e conjuntos', () => {
    const t = transitionTable(ex('sipser-n1'));
    expect(t.columns.map((c) => c.label)).toEqual(['0', '1', 'ε']);
    const q1 = t.rows.find((r) => r.name === 'q1')!;
    expect(q1.cells[1].targets).toHaveLength(2); // δ(q1,1) = {q1, q2}
    expect(q1.initial).toBe(true);
  });
});
