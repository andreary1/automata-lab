import type { Issue, ValidationReport } from '../fa/validate';
import { symbolProblem } from '../fa/symbols';
import type { PDA } from './model';
import { transitionLabel } from './model';

/** Estados alcançáveis a partir do inicial pelas arestas com ao menos uma transição. */
export function reachablePDA(m: PDA): Set<string> {
  const seen = new Set<string>();
  if (!m.initial || !m.states.some((s) => s.id === m.initial)) return seen;
  seen.add(m.initial);
  const stack = [m.initial];
  while (stack.length) {
    const q = stack.pop()!;
    for (const e of m.edges) if (e.from === q && e.transitions.length && !seen.has(e.to)) seen.add(e.to), stack.push(e.to);
  }
  return seen;
}

/**
 * Validação contra a Definição 2.13. Erros impedem a simulação; avisos e informações não.
 */
export function validatePDA(m: PDA): ValidationReport {
  const issues: Issue[] = [];
  const name = (id: string) => m.states.find((s) => s.id === id)?.name ?? id;
  const ids = new Set(m.states.map((s) => s.id));
  const sigma = new Set(m.inputAlphabet);
  const gamma = new Set(m.stackAlphabet);

  if (m.states.length === 0) issues.push({ severity: 'error', code: 'no-states', message: 'A máquina não tem estados.', fix: 'Use a ferramenta "Estado" (tecla S) e clique no canvas.' });
  if (m.states.length > 0 && !m.initial) issues.push({ severity: 'error', code: 'no-initial', message: 'Nenhum estado inicial definido (q0 é obrigatório).', fix: 'Selecione um estado e marque "Estado inicial".' });
  else if (m.initial && !ids.has(m.initial)) issues.push({ severity: 'error', code: 'initial-missing', message: 'O estado inicial aponta para um estado inexistente.', fix: 'Escolha outro estado como inicial.' });

  if (m.inputAlphabet.length === 0) issues.push({ severity: 'warning', code: 'empty-alphabet', message: 'Σ está vazio: a única entrada possível é ε.', fix: 'Adicione símbolos a Σ no painel "Máquina".' });
  for (const [label, list] of [['Σ', m.inputAlphabet], ['Γ', m.stackAlphabet]] as const)
    for (const s of list) {
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

  let multiPush = 0;
  for (const e of m.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) {
      issues.push({ severity: 'error', code: 'dangling-edge', message: 'Há uma transição ligada a um estado inexistente.', fix: 'Exclua a transição.', edgeIds: [e.id] });
      continue;
    }
    if (e.transitions.length === 0)
      issues.push({ severity: 'warning', code: 'empty-edge', message: `A seta ${name(e.from)} → ${name(e.to)} não tem transições e será ignorada.`, fix: 'Selecione a seta e adicione uma transição, ou exclua-a.', edgeIds: [e.id] });
    const seen = new Set<string>();
    for (const t of e.transitions) {
      const label = transitionLabel(t, m.stackAlphabet);
      const where = `${name(e.from)} → ${name(e.to)} ("${label}")`;
      if (t.read !== null && !sigma.has(t.read))
        issues.push({ severity: 'error', code: 'symbol-not-in-alphabet', message: `Em ${where}, o símbolo lido "${t.read}" não pertence a Σ.`, fix: 'Adicione-o a Σ ou corrija a transição.', edgeIds: [e.id] });
      if (t.pop !== null && !gamma.has(t.pop))
        issues.push({ severity: 'error', code: 'symbol-not-in-alphabet', message: `Em ${where}, o símbolo desempilhado "${t.pop}" não pertence a Γ.`, fix: 'Adicione-o a Γ ou corrija a transição.', edgeIds: [e.id] });
      const badPush = t.push.filter((x) => !gamma.has(x));
      if (badPush.length)
        issues.push({ severity: 'error', code: 'symbol-not-in-alphabet', message: `Em ${where}, empilha ${badPush.map((x) => `"${x}"`).join(', ')}, fora de Γ.`, fix: 'Adicione a Γ ou corrija a transição.', edgeIds: [e.id] });
      if (t.push.length > 1) multiPush++;
      const k = `${t.read}|${t.pop}|${t.push.join(' ')}`;
      if (seen.has(k)) issues.push({ severity: 'warning', code: 'duplicate-transition', message: `Transição repetida em ${where}.`, fix: 'Exclua a cópia.', edgeIds: [e.id] });
      seen.add(k);
    }
  }
  for (const s of m.initialStack)
    if (!gamma.has(s)) issues.push({ severity: 'error', code: 'symbol-not-in-alphabet', message: `A pilha inicial contém "${s}", que não pertence a Γ.`, fix: 'Adicione-o a Γ ou corrija a pilha inicial.' });

  if (multiPush > 0)
    issues.push({
      severity: 'info',
      code: 'pda-multi-push',
      message: `${multiPush} transição(ões) empilham mais de um símbolo. Pela Definição 2.13 empilha-se no máximo um; isso é a abreviação da prova do Lema 2.21 (Figura 2.23), equivalente a uma sequência de transições com estados intermediários. O primeiro símbolo escrito fica no topo.`,
      fix: 'Nenhuma ação necessária.',
    });

  if (m.initial && ids.has(m.initial)) {
    const reach = reachablePDA(m);
    const un = m.states.filter((s) => !reach.has(s.id));
    if (un.length) issues.push({ severity: 'info', code: 'unreachable', message: `Estado(s) inalcançável(is): ${un.map((s) => s.name).join(', ')}.`, fix: 'Ligue-os à máquina ou exclua-os.', stateIds: un.map((s) => s.id) });
  }
  if (m.acceptance === 'final' && m.states.length > 0 && !m.states.some((s) => s.accepting))
    issues.push({ severity: 'info', code: 'no-accepting', message: 'F = ∅: com aceitação por estado final, nenhuma cadeia é aceita.', fix: 'Marque algum estado como de aceitação, se não for intencional.' });
  if (m.acceptance === 'empty') {
    if (m.states.some((s) => s.accepting))
      issues.push({ severity: 'info', code: 'pda-empty-mode', message: 'No modo "pilha vazia" os estados de aceitação são ignorados: aceita-se quando a entrada termina com a pilha vazia.', fix: 'Para usar F, mude para aceitação por estado final (padrão do livro).' });
    if (m.initialStack.length === 0)
      issues.push({ severity: 'warning', code: 'pda-empty-mode', message: 'No modo "pilha vazia" com pilha inicial vazia, a cadeia vazia ε é sempre aceita (a pilha já começa vazia).', fix: 'Defina um símbolo inicial da pilha (ex.: Z) no painel "Máquina".' });
  }
  return { issues, valid: !issues.some((i) => i.severity === 'error'), incompleteDfa: false };
}
