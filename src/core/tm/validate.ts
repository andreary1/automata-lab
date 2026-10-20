import { symbolProblem } from '../fa/symbols';
import type { Issue, ValidationReport } from '../fa/validate';
import { BLANK, tapeAlphabet, tmTransitionLabel, type TM } from './model';

/** Validação contra a Definição 3.3. Erros impedem a simulação. */
export function validateTM(m: TM): ValidationReport {
  const issues: Issue[] = [];
  const name = (id: string) => m.states.find((s) => s.id === id)?.name ?? id;
  const ids = new Set(m.states.map((s) => s.id));
  const gamma = new Set(tapeAlphabet(m));

  if (m.states.length === 0) issues.push({ severity: 'error', code: 'no-states', message: 'A máquina não tem estados.', fix: 'Use a ferramenta "Estado" (tecla S) e clique no canvas.' });
  if (m.states.length > 0 && !m.initial) issues.push({ severity: 'error', code: 'no-initial', message: 'Nenhum estado inicial definido (q0 é obrigatório).', fix: 'Selecione um estado e marque "Estado inicial".' });
  else if (m.initial && !ids.has(m.initial)) issues.push({ severity: 'error', code: 'initial-missing', message: 'O estado inicial aponta para um estado inexistente.', fix: 'Escolha outro estado como inicial.' });
  if (m.states.length > 0 && (!m.acceptState || !ids.has(m.acceptState)))
    issues.push({ severity: 'error', code: 'tm-no-accept', message: 'Falta o estado de aceitação q_aceita.', fix: 'Selecione um estado e defina o papel "aceitação".' });
  if (m.rejectState && !ids.has(m.rejectState)) issues.push({ severity: 'error', code: 'tm-no-accept', message: 'O estado de rejeição aponta para um estado inexistente.', fix: 'Escolha outro estado ou use q_rejeita implícito.' });
  if (m.acceptState && m.acceptState === m.rejectState) issues.push({ severity: 'error', code: 'tm-no-accept', message: 'q_aceita e q_rejeita precisam ser estados diferentes (Def. 3.3).', fix: 'Escolha estados distintos.' });
  if (m.initial && (m.initial === m.acceptState || m.initial === m.rejectState))
    issues.push({ severity: 'info', code: 'tm-halting-initial', message: 'O estado inicial é um estado de parada: a máquina para sem ler nada.', fix: 'Se não for intencional, escolha outro estado inicial.' });

  if (m.inputAlphabet.length === 0) issues.push({ severity: 'warning', code: 'empty-alphabet', message: 'Σ está vazio: a única entrada possível é ε.', fix: 'Adicione símbolos a Σ.' });
  for (const [label, list] of [['Σ', m.inputAlphabet], ['Γ', m.tapeSymbols]] as const)
    for (const s of list) {
      if (s === BLANK) {
        if (label === 'Σ') issues.push({ severity: 'error', code: 'bad-alphabet-symbol', message: 'O branco ⊔ não pode pertencer a Σ (Def. 3.3).', fix: 'Remova ⊔ de Σ; ele já faz parte de Γ.' });
        continue;
      }
      const p = symbolProblem(s);
      if (p) issues.push({ severity: 'error', code: 'bad-alphabet-symbol', message: `Símbolo inválido em ${label}: "${s}". ${p}`, fix: 'Remova ou renomeie o símbolo.' });
    }

  const byName = new Map<string, string[]>();
  for (const s of m.states) {
    const n = s.name.trim();
    if (!n) issues.push({ severity: 'error', code: 'empty-name', message: 'Há um estado sem nome.', fix: 'Dê um nome ao estado.', stateIds: [s.id] });
    else byName.set(n, [...(byName.get(n) ?? []), s.id]);
  }
  for (const [n, list] of byName) if (list.length > 1) issues.push({ severity: 'error', code: 'duplicate-name', message: `Há ${list.length} estados chamados "${n}".`, fix: 'Renomeie para que cada nome seja único.', stateIds: list });

  // determinismo: no máximo uma transição por (estado, símbolo lido)
  const seen = new Map<string, string[]>();
  for (const e of m.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) {
      issues.push({ severity: 'error', code: 'dangling-edge', message: 'Há uma transição ligada a um estado inexistente.', fix: 'Exclua a transição.', edgeIds: [e.id] });
      continue;
    }
    if (e.transitions.length === 0) issues.push({ severity: 'warning', code: 'empty-edge', message: `A seta ${name(e.from)} → ${name(e.to)} não tem transições e será ignorada.`, fix: 'Adicione uma transição ou exclua a seta.', edgeIds: [e.id] });
    if (e.transitions.length && (e.from === m.acceptState || e.from === m.rejectState))
      issues.push({ severity: 'error', code: 'tm-halting-out', message: `${name(e.from)} é um estado de parada e não pode ter transições de saída: a máquina para ao entrar nele.`, fix: 'Exclua essas transições.', edgeIds: [e.id] });
    for (const t of e.transitions) {
      const where = `${name(e.from)} → ${name(e.to)} ("${tmTransitionLabel(t)}")`;
      for (const [what, sym] of [['lido', t.read], ['escrito', t.write]] as const)
        if (!gamma.has(sym)) issues.push({ severity: 'error', code: 'symbol-not-in-alphabet', message: `Em ${where}, o símbolo ${what} "${sym}" não pertence a Γ.`, fix: 'Adicione-o a Σ ou aos símbolos da fita, ou corrija a transição.', edgeIds: [e.id] });
      const k = `${e.from}\u0001${t.read}`;
      seen.set(k, [...(seen.get(k) ?? []), e.id]);
    }
  }
  for (const [k, edges] of seen)
    if (edges.length > 1) {
      const [from, sym] = k.split('\u0001');
      issues.push({
        severity: 'error',
        code: 'dfa-conflict',
        message: `Não determinismo: δ(${name(from)}, ${sym}) tem ${edges.length} transições. Pela Def. 3.3, δ é uma função (no máximo uma).`,
        fix: 'Mantenha só uma transição para esse símbolo neste estado.',
        stateIds: [from],
        edgeIds: [...new Set(edges)],
      });
    }

  if (m.initial && ids.has(m.initial)) {
    const reach = new Set([m.initial]);
    const stack = [m.initial];
    while (stack.length) {
      const q = stack.pop()!;
      for (const e of m.edges) if (e.from === q && e.transitions.length && !reach.has(e.to)) reach.add(e.to), stack.push(e.to);
    }
    const un = m.states.filter((s) => !reach.has(s.id) && s.id !== m.rejectState);
    if (un.length) issues.push({ severity: 'info', code: 'unreachable', message: `Estado(s) inalcançável(is): ${un.map((s) => s.name).join(', ')}.`, fix: 'Ligue-os à máquina ou exclua-os.', stateIds: un.map((s) => s.id) });
  }
  if (!m.rejectState && m.states.length > 0)
    issues.push({ severity: 'info', code: 'tm-implicit-reject', message: 'q_rejeita é implícito: pares (estado, símbolo) sem transição levam à rejeição (convenção do livro, p. 152).', fix: 'Nenhuma ação necessária. Se quiser, desenhe um estado e dê a ele o papel "rejeição".' });
  return { issues, valid: !issues.some((i) => i.severity === 'error'), incompleteDfa: false };
}
