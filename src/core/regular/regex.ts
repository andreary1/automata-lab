/**
 * Expressões regulares formais (Sipser, Definição 1.52). NÃO usa o mecanismo de
 * regex do JavaScript: há um parser próprio e as linguagens são tratadas por autômatos.
 *
 * Sintaxe aceita (documentada em docs/DECISOES.md):
 *   símbolo de Σ com 1 caractere ............ a   0
 *   símbolo com vários caracteres ou reservado <RESET>  <+>
 *   palavra vazia ............................ ε
 *   linguagem vazia .......................... ∅   (também: {} )
 *   união .................................... R ∪ S   ou   R | S
 *   concatenação ............................. RS  (justaposição)  ou  R ∘ S
 *   estrela .................................. R*
 *   R⁺ = RR* (abreviação do livro) ........... R⁺  ou  R^+
 *   Σ = (a1 ∪ … ∪ ak) (abreviação do livro) .. Σ
 *   parênteses ............................... ( R )
 * Precedência (p. 66): estrela, depois concatenação, depois união.
 * O caractere "+" sozinho NÃO é aceito: em alguns livros ele é união, no Sipser é R⁺.
 */

export type Re =
  | { t: 'sym'; a: string; str: string; prec: 2 }
  | { t: 'eps'; str: string; prec: 2 }
  | { t: 'empty'; str: string; prec: 2 }
  | { t: 'union'; l: Re; r: Re; str: string; prec: 0 }
  | { t: 'concat'; l: Re; r: Re; str: string; prec: 1 }
  | { t: 'star'; r: Re; str: string; prec: 2 };

const RESERVED = new Set(['(', ')', '∪', '|', '*', '⁺', '+', '^', 'ε', '∅', 'Σ', '∘', '<', '>', '{', '}']);

export function symbolText(a: string): string {
  return [...a].length === 1 && !RESERVED.has(a) && !/\s/.test(a) ? a : `<${a}>`;
}

// ---- construtores "crus" (sem simplificação) ----
export const EPS_RE: Re = { t: 'eps', str: 'ε', prec: 2 };
export const EMPTY_RE: Re = { t: 'empty', str: '∅', prec: 2 };
export const sym = (a: string): Re => ({ t: 'sym', a, str: symbolText(a), prec: 2 });
const wrap = (r: Re, min: number) => (r.prec < min ? `(${r.str})` : r.str);
export const rawUnion = (l: Re, r: Re): Re => ({ t: 'union', l, r, str: `${l.str} ∪ ${r.str}`, prec: 0 });
export const rawConcat = (l: Re, r: Re): Re => ({ t: 'concat', l, r, str: `${wrap(l, 1)}${wrap(r, 1)}`, prec: 1 });
export const rawStar = (r: Re): Re => ({ t: 'star', r, str: `${wrap(r, 2)}*`, prec: 2 });

// ---- construtores com simplificações que preservam a linguagem ----
// R ∪ ∅ = R;  R ∪ R = R;  ε ∪ R* = R*;  R∅ = ∅R = ∅;  Rε = εR = R;  ∅* = ε;  ε* = ε;  (R*)* = R*
export function union(l: Re, r: Re): Re {
  if (l.t === 'empty') return r;
  if (r.t === 'empty') return l;
  if (l.str === r.str) return l;
  if (l.t === 'eps' && r.t === 'star') return r;
  if (r.t === 'eps' && l.t === 'star') return l;
  return rawUnion(l, r);
}
export function concat(l: Re, r: Re): Re {
  if (l.t === 'empty' || r.t === 'empty') return EMPTY_RE;
  if (l.t === 'eps') return r;
  if (r.t === 'eps') return l;
  return rawConcat(l, r);
}
export function star(r: Re): Re {
  if (r.t === 'empty' || r.t === 'eps') return EPS_RE;
  if (r.t === 'star') return r;
  return rawStar(r);
}

/** Forma totalmente parentizada, no estilo da Definição 1.52. */
export function fullyParenthesized(r: Re): string {
  switch (r.t) {
    case 'sym':
    case 'eps':
    case 'empty':
      return r.str;
    case 'union':
      return `(${fullyParenthesized(r.l)} ∪ ${fullyParenthesized(r.r)})`;
    case 'concat':
      return `(${fullyParenthesized(r.l)} ∘ ${fullyParenthesized(r.r)})`;
    case 'star':
      return `(${fullyParenthesized(r.r)})*`;
  }
}

export function symbolsOf(r: Re, out = new Set<string>()): Set<string> {
  if (r.t === 'sym') out.add(r.a);
  else if (r.t === 'union' || r.t === 'concat') symbolsOf(r.l, out), symbolsOf(r.r, out);
  else if (r.t === 'star') symbolsOf(r.r, out);
  return out;
}

export class RegexSyntaxError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message);
    this.name = 'RegexSyntaxError';
  }
}

export interface ParseOptions {
  /** Σ explícito. Se null, Σ é inferido dos símbolos que aparecem (e Σ abreviado fica proibido). */
  alphabet: string[] | null;
}

export interface ParseResult {
  re: Re;
  /** Σ efetivo (o informado, ou o inferido). */
  alphabet: string[];
}

type Tok = { k: 'sym'; a: string; pos: number } | { k: 'op'; v: string; pos: number };

function lex(src: string): Tok[] {
  const chars = [...src];
  const toks: Tok[] = [];
  for (let i = 0; i < chars.length; ) {
    const c = chars[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '<') {
      const end = chars.indexOf('>', i + 1);
      if (end < 0) throw new RegexSyntaxError('"<" sem ">" correspondente. Símbolos com vários caracteres são escritos como <NOME>.', i);
      const name = chars.slice(i + 1, end).join('').trim();
      if (!name) throw new RegexSyntaxError('Símbolo vazio "<>".', i);
      toks.push({ k: 'sym', a: name, pos: i });
      i = end + 1;
      continue;
    }
    if (c === '{' && chars[i + 1] === '}') {
      toks.push({ k: 'op', v: '∅', pos: i });
      i += 2;
      continue;
    }
    if (c === '^') {
      if (chars[i + 1] === '+') {
        toks.push({ k: 'op', v: '⁺', pos: i });
        i += 2;
        continue;
      }
      throw new RegexSyntaxError('"^" só é aceito como "^+" (R⁺ = RR*).', i);
    }
    if (c === '+') throw new RegexSyntaxError('"+" é ambíguo: use ∪ ou | para união; para R⁺ (= RR*) use ⁺ ou ^+.', i);
    if (c === '|') {
      toks.push({ k: 'op', v: '∪', pos: i });
      i++;
      continue;
    }
    if (c === '>' || c === '}' || c === '{') throw new RegexSyntaxError(`Caractere "${c}" inesperado.`, i);
    if (RESERVED.has(c)) {
      toks.push({ k: 'op', v: c, pos: i });
      i++;
      continue;
    }
    toks.push({ k: 'sym', a: c, pos: i });
    i++;
  }
  return toks;
}

/** Analisa uma expressão regular. Lança RegexSyntaxError com a posição (em caracteres). */
export function parseRegex(src: string, opts: ParseOptions): ParseResult {
  const toks = lex(src);
  if (toks.length === 0) throw new RegexSyntaxError('Expressão vazia. Para a linguagem {ε} escreva ε; para a linguagem vazia escreva ∅.', 0);
  let p = 0;
  const sigma = opts.alphabet;
  const used: string[] = [];
  const peek = () => toks[p];
  const isAtomStart = (t: Tok | undefined) => !!t && (t.k === 'sym' || ['(', 'ε', '∅', 'Σ'].includes(t.v));

  const parseUnion = (): Re => {
    let left = parseConcat();
    while (peek()?.k === 'op' && (peek() as { v: string }).v === '∪') {
      p++;
      if (!peek() || !(isAtomStart(peek()))) throw new RegexSyntaxError('Falta o operando direito da união.', peek()?.pos ?? [...src].length);
      left = rawUnion(left, parseConcat());
    }
    return left;
  };
  const parseConcat = (): Re => {
    let left = parsePostfix();
    for (;;) {
      const t = peek();
      if (t?.k === 'op' && t.v === '∘') {
        p++;
        if (!isAtomStart(peek())) throw new RegexSyntaxError('Falta o operando direito de ∘.', peek()?.pos ?? [...src].length);
        left = rawConcat(left, parsePostfix());
      } else if (isAtomStart(t)) left = rawConcat(left, parsePostfix());
      else return left;
    }
  };
  const parsePostfix = (): Re => {
    let r = parseAtom();
    for (;;) {
      const t = peek();
      if (t?.k === 'op' && t.v === '*') {
        p++;
        r = rawStar(r);
      } else if (t?.k === 'op' && t.v === '⁺') {
        p++;
        r = rawConcat(r, rawStar(r)); // R⁺ = RR*
      } else return r;
    }
  };
  const parseAtom = (): Re => {
    const t = peek();
    if (!t) throw new RegexSyntaxError('A expressão termina cedo demais: falta um operando.', [...src].length);
    if (t.k === 'sym') {
      p++;
      if (sigma && !sigma.includes(t.a))
        throw new RegexSyntaxError(`O símbolo "${t.a}" não pertence a Σ = {${sigma.join(', ')}}.${[...t.a].length > 1 ? '' : ' Para símbolos com vários caracteres use <NOME>.'}`, t.pos);
      if (!used.includes(t.a)) used.push(t.a);
      return sym(t.a);
    }
    switch (t.v) {
      case 'ε':
        p++;
        return EPS_RE;
      case '∅':
        p++;
        return EMPTY_RE;
      case 'Σ': {
        p++;
        if (!sigma) throw new RegexSyntaxError('Para usar Σ, informe o alfabeto explicitamente.', t.pos);
        if (sigma.length === 0) return EMPTY_RE;
        return sigma.map(sym).reduce((a, b) => rawUnion(a, b));
      }
      case '(': {
        p++;
        if (peek()?.k === 'op' && (peek() as { v: string }).v === ')') throw new RegexSyntaxError('Parênteses vazios "()". Use ε para a palavra vazia.', t.pos);
        const inner = parseUnion();
        const close = peek();
        if (!close || close.k !== 'op' || close.v !== ')') throw new RegexSyntaxError('Falta fechar parêntese ")".', close?.pos ?? [...src].length);
        p++;
        // parênteses não geram nó: só agrupam
        return inner;
      }
      case ')':
        throw new RegexSyntaxError('")" sem "(" correspondente.', t.pos);
      case '*':
      case '⁺':
        throw new RegexSyntaxError(`"${t.v}" precisa vir depois de uma expressão.`, t.pos);
      case '∪':
        throw new RegexSyntaxError('Falta o operando esquerdo da união.', t.pos);
      case '∘':
        throw new RegexSyntaxError('Falta o operando esquerdo de ∘.', t.pos);
      default:
        throw new RegexSyntaxError(`Símbolo inesperado "${t.v}".`, t.pos);
    }
  };

  const re = parseUnion();
  if (p < toks.length) {
    const t = toks[p];
    throw new RegexSyntaxError(t.k === 'op' && t.v === ')' ? '")" sem "(" correspondente.' : 'Símbolo inesperado depois do fim da expressão.', t.pos);
  }
  return { re, alphabet: sigma ? [...sigma] : used };
}
