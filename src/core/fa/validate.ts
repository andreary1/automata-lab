import { buildDelta, reachableStates } from './delta';
import type { FiniteAutomaton } from './model';
import { symbolProblem } from './symbols';

export type Severity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'no-states'
  | 'no-initial'
  | 'initial-missing'
  | 'empty-alphabet'
  | 'bad-alphabet-symbol'
  | 'duplicate-name'
  | 'empty-name'
  | 'symbol-not-in-alphabet'
  | 'empty-edge'
  | 'dangling-edge'
  | 'dfa-epsilon'
  | 'dfa-conflict'
  | 'dfa-missing'
  | 'unreachable'
  | 'no-accepting'
  | 'duplicate-transition'
  | 'pda-multi-push'
  | 'pda-empty-mode'
  | 'tm-no-accept'
  | 'tm-halting-initial'
  | 'tm-halting-out'
  | 'tm-implicit-reject';

export interface Issue {
  severity: Severity;
  code: IssueCode;
  message: string;
  /** Como resolver, em linguagem direta. */
  fix: string;
  stateIds?: string[];
  edgeIds?: string[];
}

export interface ValidationReport {
  issues: Issue[];
  /** Sem erros: a máquina satisfaz a definição formal do seu tipo (AFD ou AFN). */
  valid: boolean;
  /** AFD sem erros, mas incompleto (faltam transições). Simulável pela convenção de poço implícito. */
  incompleteDfa: boolean;
}

/**
 * Validação contra Def. 1.5 (AFD) e Def. 1.37 (AFN).
 * Erros impedem simulação e algoritmos; avisos não.
 */
export function validate(m: FiniteAutomaton): ValidationReport {
  const issues: Issue[] = [];
  const name = (id: string) => m.states.find((s) => s.id === id)?.name ?? id;
  const ids = new Set(m.states.map((s) => s.id));
  const sigma = new Set(m.alphabet);

  if (m.states.length === 0) {
    issues.push({
      severity: 'error',
      code: 'no-states',
      message: 'A máquina não tem estados.',
      fix: 'Use a ferramenta "Estado" (tecla S) e clique no canvas para criar estados.',
    });
  }
  if (m.states.length > 0 && !m.initial) {
    issues.push({
      severity: 'error',
      code: 'no-initial',
      message: 'Nenhum estado inicial definido (q0 é obrigatório).',
      fix: 'Selecione um estado e marque "Estado inicial" no painel de propriedades.',
    });
  } else if (m.initial && !ids.has(m.initial)) {
    issues.push({
      severity: 'error',
      code: 'initial-missing',
      message: 'O estado inicial aponta para um estado que não existe.',
      fix: 'Escolha outro estado como inicial.',
    });
  }

  if (m.alphabet.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'empty-alphabet',
      message: 'Σ está vazio: a única cadeia possível é ε.',
      fix: 'Adicione símbolos ao alfabeto no painel "Máquina".',
    });
  }
  for (const s of m.alphabet) {
    const p = symbolProblem(s);
    if (p) issues.push({ severity: 'error', code: 'bad-alphabet-symbol', message: `Símbolo inválido em Σ: "${s}". ${p}`, fix: 'Remova ou renomeie o símbolo.' });
  }

  const byName = new Map<string, string[]>();
  for (const s of m.states) {
    const n = s.name.trim();
    if (n === '') {
      issues.push({ severity: 'error', code: 'empty-name', message: 'Há um estado sem nome.', fix: 'Dê um nome ao estado no painel de propriedades.', stateIds: [s.id] });
      continue;
    }
    byName.set(n, [...(byName.get(n) ?? []), s.id]);
  }
  for (const [n, list] of byName) {
    if (list.length > 1) {
      issues.push({
        severity: 'error',
        code: 'duplicate-name',
        message: `Há ${list.length} estados chamados "${n}". Na definição formal, Q seria ambíguo.`,
        fix: 'Renomeie os estados para que cada nome seja único.',
        stateIds: list,
      });
    }
  }

  for (const e of m.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) {
      issues.push({ severity: 'error', code: 'dangling-edge', message: 'Há uma transição ligada a um estado inexistente.', fix: 'Exclua a transição.', edgeIds: [e.id] });
      continue;
    }
    if (e.symbols.length === 0 && !e.epsilon) {
      issues.push({
        severity: 'warning',
        code: 'empty-edge',
        message: `A transição ${name(e.from)} → ${name(e.to)} não tem símbolos e será ignorada.`,
        fix: 'Selecione a transição e marque ao menos um símbolo, ou exclua-a.',
        edgeIds: [e.id],
      });
    }
    const stray = e.symbols.filter((s) => !sigma.has(s));
    if (stray.length) {
      issues.push({
        severity: 'error',
        code: 'symbol-not-in-alphabet',
        message: `A transição ${name(e.from)} → ${name(e.to)} usa ${stray.map((s) => `"${s}"`).join(', ')}, que não pertence${stray.length > 1 ? 'm' : ''} a Σ.`,
        fix: 'Adicione o símbolo a Σ ou remova-o da transição.',
        edgeIds: [e.id],
      });
    }
  }

  let incompleteDfa = false;
  if (m.kind === 'dfa') {
    const epsEdges = m.edges.filter((e) => e.epsilon);
    if (epsEdges.length) {
      issues.push({
        severity: 'error',
        code: 'dfa-epsilon',
        message: `Um AFD não admite transições ε (δ: Q × Σ → Q). Há ${epsEdges.length} transição(ões) com ε.`,
        fix: 'Remova ε dessas transições ou mude o tipo da máquina para AFN.',
        edgeIds: epsEdges.map((e) => e.id),
      });
    }
    const delta = buildDelta(m);
    const missing: { state: string; sym: string }[] = [];
    for (const s of m.states) {
      const row = delta.get(s.id)!;
      for (const sym of m.alphabet) {
        const entry = row.get(sym);
        if (!entry || entry.targets.size === 0) missing.push({ state: s.id, sym });
        else if (entry.targets.size > 1) {
          issues.push({
            severity: 'error',
            code: 'dfa-conflict',
            message: `Conflito: δ(${s.name}, ${sym}) tem ${entry.targets.size} destinos (${[...entry.targets].map(name).join(', ')}). Em um AFD há exatamente um.`,
            fix: 'Remova o símbolo de uma das transições, ou mude o tipo para AFN.',
            stateIds: [s.id],
            edgeIds: [...entry.edgeByTarget.values()],
          });
        }
      }
    }
    if (missing.length) {
      incompleteDfa = true;
      const preview = missing
        .slice(0, 6)
        .map((x) => `δ(${name(x.state)}, ${x.sym})`)
        .join(', ');
      issues.push({
        severity: 'warning',
        code: 'dfa-missing',
        message: `AFD incompleto: ${missing.length} transição(ões) ausente(s): ${preview}${missing.length > 6 ? '…' : ''}. Pela Def. 1.5, δ deve estar definida para todo par (estado, símbolo).`,
        fix: 'Adicione as transições que faltam ou use "Completar com estado poço". Enquanto isso, a simulação trata a ausência como um poço implícito (rejeita).',
        stateIds: [...new Set(missing.map((x) => x.state))],
      });
    }
  }

  if (m.initial && ids.has(m.initial)) {
    const reach = reachableStates(m);
    const unreachable = m.states.filter((s) => !reach.has(s.id));
    if (unreachable.length) {
      issues.push({
        severity: 'info',
        code: 'unreachable',
        message: `Estado(s) inalcançável(is) a partir de ${name(m.initial)}: ${unreachable.map((s) => s.name).join(', ')}. Eles não afetam a linguagem.`,
        fix: 'Ligue-os ao restante da máquina ou exclua-os.',
        stateIds: unreachable.map((s) => s.id),
      });
    }
  }
  if (m.states.length > 0 && !m.states.some((s) => s.accepting)) {
    issues.push({
      severity: 'info',
      code: 'no-accepting',
      message: 'F = ∅: nenhum estado de aceitação. A máquina reconhece a linguagem vazia ∅.',
      fix: 'Se não for intencional, marque algum estado como "aceitação".',
    });
  }

  const valid = !issues.some((i) => i.severity === 'error');
  return { issues, valid, incompleteDfa: valid && incompleteDfa };
}
