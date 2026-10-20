import { describe, expect, it } from 'vitest';
import { BLANK, tmEdgeLabelLines, type TM } from './model';
import { TM_EXAMPLES } from './examples';
import { configAt, formatConfig, simulateTM, TMCancelled, runTM } from './simulate';
import { validateTM } from './validate';
import { runBatchTM } from './batch';
import { setHaltRole } from './edit';

const ex = (k: string) => TM_EXAMPLES.find((e) => e.key === k)!.machine;
const norm = (s: string) => s.replace(/ /g, '').replace(/⊔+$/, '');

function words(sigma: string[], maxLen: number): string[] {
  const out = [''];
  let layer = [''];
  for (let n = 1; n <= maxLen; n++) {
    layer = layer.flatMap((w) => sigma.map((a) => w + a));
    out.push(...layer);
  }
  return out;
}

describe('MT: Exemplo 3.7 (M₂, potências de 2)', () => {
  const m = ex('sipser-m2');
  it('é válida pela Definição 3.3', () => {
    expect(validateTM(m).valid).toBe(true);
  });
  it('reproduz exatamente a sequência de configurações da p. 151 para 0000', () => {
    const t = simulateTM(m, '0000');
    expect(t.status).toBe('accepted');
    const book = [
      'q10000', '⊔q2000', '⊔xq300', '⊔x0q40', '⊔x0xq3⊔', '⊔x0q5x⊔', '⊔xq50x⊔', '⊔q5x0x⊔', 'q5⊔x0x⊔', '⊔q2x0x⊔',
      '⊔xq20x⊔', '⊔xxq3x⊔', '⊔xxxq3⊔', '⊔xxq5x⊔', '⊔xq5xx⊔', '⊔q5xxx⊔', 'q5⊔xxx⊔', '⊔q2xxx⊔',
      '⊔xq2xx⊔', '⊔xxq2x⊔', '⊔xxxq2⊔', '⊔xxx⊔qaceita',
    ];
    const ours = Array.from({ length: t.steps.length + 1 }, (_, k) => norm(formatConfig(m, configAt(t, k))));
    expect(ours).toEqual(book.map(norm));
    expect(t.stepCount).toBe(book.length - 1);
  });
  it('decide a linguagem em todas as cadeias até tamanho 20', () => {
    for (let n = 0; n <= 20; n++) {
      const t = simulateTM(m, '0'.repeat(n), {}, false);
      const pow2 = n > 0 && (n & (n - 1)) === 0;
      expect(t.status, `n=${n}`).toBe(pow2 ? 'accepted' : 'rejected');
    }
  });
  it('rejeita entrando no estado de rejeição explícito', () => {
    const t = simulateTM(m, '000');
    expect(t.halt).toBe('reject');
  });
});

describe('MT: Exemplo 3.9 (M₁, w#w)', () => {
  const m = ex('sipser-m1');
  it('aceita a entrada mostrada no livro', () => {
    expect(simulateTM(m, '011000#011000').status).toBe('accepted');
  });
  it('decide { w#w } em todas as cadeias sobre {0,1,#} até tamanho 7 (amostragem complementar)', () => {
    for (const w of words(['0', '1', '#'], 7)) {
      const parts = w.split('#');
      const inL = parts.length === 2 && parts[0] === parts[1];
      const t = simulateTM(m, w, {}, false);
      expect(t.status, w).toBe(inL ? 'accepted' : 'rejected');
    }
  });
  it('rejeita por transição ausente (q_rejeita implícito, p. 152)', () => {
    const t = simulateTM(m, '0#1');
    expect(t.status).toBe('rejected');
    expect(t.halt).toBe('implicit-reject');
    expect(t.reason).toMatch(/p\. 152/);
  });
});

describe('MT: semântica da fita', () => {
  it('mover para a esquerda na primeira célula mantém o cabeçote no lugar', () => {
    const m: TM = {
      kind: 'tm', inputAlphabet: ['a'], tapeSymbols: ['b'], initial: 'p', acceptState: 'acc', rejectState: null,
      states: [{ id: 'p', name: 'p', x: 0, y: 0, accepting: false }, { id: 'q', name: 'q', x: 0, y: 0, accepting: false }, { id: 'acc', name: 'acc', x: 0, y: 0, accepting: false }],
      edges: [
        { id: 'e1', from: 'p', to: 'q', transitions: [{ id: 't1', read: 'a', write: 'b', move: 'L' }] },
        { id: 'e2', from: 'q', to: 'acc', transitions: [{ id: 't2', read: 'b', write: 'b', move: 'R' }] },
      ],
    };
    const t = simulateTM(m, 'a');
    expect(t.status).toBe('accepted');
    expect(t.steps[0].newHead).toBe(0);
    expect(configAt(t, 1)).toEqual({ state: 'q', head: 0, tape: ['b'] });
    expect(t.finalTape).toEqual(['b']);
  });
  it('a fita cresce para a direita sob demanda com brancos', () => {
    const t = simulateTM(ex('invert-bits'), '1011');
    expect(t.status).toBe('accepted');
    expect(t.finalTape).toEqual(['0', '1', '0', '0']);
    expect(t.maxHead).toBe(4);
    expect(configAt(t, 4).tape.length).toBe(4);
    expect(configAt(t, 5).head).toBe(3);
  });
  it('a entrada vazia começa com o cabeçote sobre um branco', () => {
    const t = simulateTM(ex('sipser-m2'), '');
    expect(t.steps[0].read).toBe(BLANK);
    expect(t.status).toBe('rejected');
  });
  it('formata configurações como u q v (ua qi ≡ ua qi ⊔)', () => {
    const m = ex('sipser-m2');
    expect(formatConfig(m, { state: 's_q2', head: 3, tape: ['⊔', 'x', 'x'] })).toBe('⊔xx q2 ⊔');
    expect(formatConfig(m, { state: 's_q1', head: 0, tape: ['0', '0'] })).toBe('q1 00');
  });
});

describe('MT: parada, laço e limites', () => {
  it('limite de passos dá "inconclusiva", nunca rejeição', () => {
    const t = simulateTM(ex('search-one'), '000', { maxSteps: 500 });
    expect(t.status).toBe('inconclusive');
    expect(t.stepCount).toBe(500);
    expect(t.reason).toMatch(/NÃO prova/);
  });
  it('configuração repetida é prova de laço (máquina determinística)', () => {
    const t = simulateTM(ex('ping-pong'), 'aa');
    expect(t.status).toBe('loop');
    const a = configAt(t, t.loopFrom!);
    const b = configAt(t, t.loopAt!);
    expect(b).toEqual(a);
  });
  it('a entrada vazia é aceita no exemplo vai-e-volta', () => {
    expect(simulateTM(ex('ping-pong'), '').status).toBe('accepted');
  });
  it('cancelamento interrompe execuções longas', () => {
    let calls = 0;
    expect(() => runTM(ex('search-one'), ['0'], { maxSteps: 1e7, shouldCancel: () => ++calls > 2 }, false)).toThrow(TMCancelled);
  });
  it('lote: laço conta como não aceita; inconclusiva não confere', () => {
    const r = runBatchTM(ex('search-one'), [{ input: '01', expected: 'accepted' }, { input: '00', expected: 'rejected' }], { maxSteps: 300 });
    expect(r[0].matches).toBe(true);
    expect(r[1].status).toBe('inconclusive');
    expect(r[1].matches).toBeUndefined();
    const p = runBatchTM(ex('ping-pong'), [{ input: 'a', expected: 'rejected' }]);
    expect(p[0].status).toBe('loop');
    expect(p[0].matches).toBe(true);
  });
  it('todos os exemplos passam no próprio lote (com limite de 2000 passos)', () => {
    for (const e of TM_EXAMPLES) {
      const r = runBatchTM(e.machine, e.tests, { maxSteps: 2000 });
      for (const x of r) if (x.status !== 'inconclusive') expect(x.matches, `${e.key}: ${x.input}`).toBe(true);
    }
  });
});

describe('MT: validação (Def. 3.3)', () => {
  const base = () => structuredClone(ex('sipser-m2'));
  it('não determinismo é erro', () => {
    const m = base();
    m.edges[0].transitions.push({ id: 'dup', read: '0', write: 'x', move: 'L' });
    m.edges[0].transitions = m.edges[0].transitions;
    const r = validateTM(m);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.code === 'dfa-conflict')).toBe(true);
  });
  it('⊔ em Σ é erro; símbolo fora de Γ é erro', () => {
    const m = base();
    m.inputAlphabet = ['0', BLANK];
    expect(validateTM(m).issues.some((i) => i.code === 'bad-alphabet-symbol')).toBe(true);
    const m2 = base();
    m2.edges[0].transitions[0].write = 'y';
    expect(validateTM(m2).issues.some((i) => i.code === 'symbol-not-in-alphabet')).toBe(true);
  });
  it('q_aceita obrigatório e diferente de q_rejeita; estados de parada sem saídas', () => {
    const m = base();
    expect(validateTM({ ...m, acceptState: null }).valid).toBe(false);
    expect(validateTM({ ...m, rejectState: m.acceptState }).valid).toBe(false);
    const out = setHaltRole(m, 's_q5', 'accept');
    expect(validateTM(out).issues.some((i) => i.code === 'tm-halting-out')).toBe(true);
  });
  it('q_rejeita implícito é só informação', () => {
    const r = validateTM(ex('sipser-m1'));
    expect(r.valid).toBe(true);
    expect(r.issues.find((i) => i.code === 'tm-implicit-reject')?.severity).toBe('info');
  });
  it('rótulos agrupados como no livro', () => {
    const m = ex('sipser-m2');
    expect(tmEdgeLabelLines(m.edges.find((e) => e.from === 's_q5' && e.to === 's_q5')!)).toEqual(['0,x→E']);
    expect(tmEdgeLabelLines(m.edges[0])).toEqual(['0→⊔,D']);
  });
});

describe('MT: registro limitado', () => {
  it('a execução continua além do registro navegável e informa isso', () => {
    const t = simulateTM(ex('search-one'), '0', { maxSteps: 250_000 });
    expect(t.status).toBe('inconclusive');
    expect(t.stepCount).toBe(250_000);
    expect(t.recordTruncated).toBe(true);
    expect(t.steps.length).toBeLessThan(t.stepCount);
  });
});
