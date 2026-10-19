import type { FiniteAutomaton } from '../core/fa/model';
import { diagramBounds } from './geometry';

/**
 * Exporta o diagrama a partir do MESMO SVG renderizado no canvas (sem segunda
 * implementação de desenho). Destaques de seleção/simulação são removidos e as
 * cores do tema claro são embutidas.
 */
const EXPORT_CSS = `
.edge-hit{display:none}
.edge-line{fill:none;stroke:#1f2430;stroke-width:1.6}
.arrowhead{fill:#1f2430}
.state-circle{fill:#ffffff;stroke:#1f2430;stroke-width:1.8}
.state-inner{fill:none;stroke:#1f2430;stroke-width:1.5}
.state-name{font:600 14px ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;fill:#1f2430;text-anchor:middle}
.edge-label{font:500 13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:#1f2430;text-anchor:middle;paint-order:stroke;stroke:#ffffff;stroke-width:5px;stroke-linejoin:round}
.initial-arrow{fill:none;stroke:#1f2430;stroke-width:1.6}
.halo,.active-badge,.issue-badge{display:none}
`;

export function diagramSVGString(svg: SVGSVGElement, m: FiniteAutomaton): string {
  const content = svg.querySelector('g.diagram-content');
  const b = diagramBounds(m);
  const clone = content ? (content.cloneNode(true) as SVGGElement) : document.createElementNS('http://www.w3.org/2000/svg', 'g');
  clone.querySelectorAll('[class]').forEach((el) => {
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => !['selected', 'active', 'used', 'issue', 'pending'].includes(c));
    el.setAttribute('class', cls.join(' '));
  });
  clone.querySelectorAll('[tabindex],[role],[aria-label],[aria-pressed],[data-state-id]').forEach((el) => {
    ['tabindex', 'role', 'aria-label', 'aria-pressed', 'data-state-id'].forEach((a) => el.removeAttribute(a));
  });
  clone.querySelectorAll('[marker-end]').forEach((el) => el.setAttribute('marker-end', 'url(#arrow)'));
  const ns = 'http://www.w3.org/2000/svg';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${ns}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${Math.round(b.w)}" height="${Math.round(b.h)}">
<style>${EXPORT_CSS}</style>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 0 0 L 10 5 L 0 10 z" class="arrowhead"/></marker></defs>
<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff"/>
${new XMLSerializer().serializeToString(clone)}
</svg>`;
}

export function downloadText(filename: string, text: string, type: string) {
  downloadBlob(filename, new Blob([text], { type }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function svgToPng(svgText: string, scale = 2): Promise<Blob> {
  const img = new Image();
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Falha ao rasterizar o SVG.'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(img.width * scale);
  canvas.height = Math.ceil(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar PNG.'))), 'image/png'));
}

export function safeFileName(name: string): string {
  return (name.trim() || 'automato').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'automato';
}
