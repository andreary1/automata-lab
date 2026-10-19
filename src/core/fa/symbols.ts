/**
 * Regras para símbolos do alfabeto e divisão da entrada em símbolos.
 *
 * Convenções do app (documentadas em docs/DECISOES.md):
 *  - Um símbolo é uma sequência não vazia de caracteres SEM espaços em branco,
 *    sem vírgula e diferente dos símbolos reservados ε, ∅, e "eps".
 *  - Se TODOS os símbolos de Σ têm um único caractere, a cadeia é lida
 *    caractere a caractere; espaços são ignorados ("0 1 1" = "011").
 *  - Se ALGUM símbolo tem vários caracteres (ex.: ⟨RESET⟩ no Exemplo 1.13
 *    do Sipser), a cadeia DEVE ser escrita com os símbolos separados por
 *    espaço ("1 0 RESET 2"). Isso torna a divisão inequívoca.
 *  - A palavra vazia ε é a cadeia sem nenhum símbolo (campo vazio). Por
 *    conveniência, a entrada exatamente igual a "ε" também denota a
 *    palavra vazia.
 */

export const RESERVED_SYMBOLS = ['ε', '∅', 'eps', 'Ε'];

export function symbolProblem(sym: string): string | null {
  if (sym.length === 0) return 'O símbolo não pode ser vazio. A palavra vazia é representada por ε, que não pertence a Σ.';
  if (/\s/.test(sym)) return 'Símbolos não podem conter espaços.';
  if (sym.includes(',')) return 'Símbolos não podem conter vírgula (ela separa símbolos nos rótulos).';
  if (RESERVED_SYMBOLS.includes(sym)) return `"${sym}" é reservado: ε denota a palavra vazia e ∅ a linguagem vazia.`;
  return null;
}

export function isMultiCharAlphabet(alphabet: string[]): boolean {
  return alphabet.some((s) => [...s].length > 1);
}

/** Interpreta um texto como lista de símbolos de alfabeto (separados por vírgula ou espaço). */
export function parseAlphabetText(text: string): { symbols: string[]; errors: string[] } {
  const raw = text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const symbols: string[] = [];
  const errors: string[] = [];
  for (const s of raw) {
    const p = symbolProblem(s);
    if (p) errors.push(`"${s}": ${p}`);
    else if (!symbols.includes(s)) symbols.push(s);
  }
  return { symbols, errors };
}

export type TokenizeResult =
  | { ok: true; tokens: string[] }
  | { ok: false; error: string; position?: number; tokens: string[] };

/**
 * Divide a entrada em símbolos de Σ. Nunca "adivinha": símbolos fora de Σ
 * produzem erro de entrada inválida com a posição.
 */
export function tokenize(input: string, alphabet: string[]): TokenizeResult {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === 'ε') return { ok: true, tokens: [] };
  const sigma = new Set(alphabet);

  if (isMultiCharAlphabet(alphabet)) {
    const tokens = trimmed.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      if (!sigma.has(tokens[i])) {
        return {
          ok: false,
          tokens: tokens.slice(0, i),
          position: i,
          error: `O símbolo "${tokens[i]}" (posição ${i + 1}) não pertence a Σ = {${alphabet.join(', ')}}. Como Σ tem símbolos com vários caracteres, separe os símbolos por espaço.`,
        };
      }
    }
    return { ok: true, tokens };
  }

  const chars = [...trimmed].filter((c) => !/\s/.test(c));
  for (let i = 0; i < chars.length; i++) {
    if (!sigma.has(chars[i])) {
      return {
        ok: false,
        tokens: chars.slice(0, i),
        position: i,
        error:
          chars[i] === 'ε'
            ? 'ε não é um símbolo de entrada: para testar a palavra vazia, deixe o campo vazio (ou digite apenas ε).'
            : `O símbolo "${chars[i]}" (posição ${i + 1}) não pertence a Σ = {${alphabet.join(', ')}}.`,
      };
    }
  }
  return { ok: true, tokens: chars };
}

/** Forma canônica de exibição de uma cadeia já dividida em símbolos. */
export function formatWord(tokens: string[], alphabet: string[]): string {
  if (tokens.length === 0) return 'ε';
  return isMultiCharAlphabet(alphabet) ? tokens.join(' ') : tokens.join('');
}
