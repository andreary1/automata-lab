import { useApp, type View } from '../state/store';

/**
 * Movimento da "câmera" do diagrama (deslocamento e zoom), seguindo os princípios de
 * interfaces fluidas da Apple (WWDC 2018, "Designing Fluid Interfaces"):
 *  - molas criticamente amortecidas (damping 1.0, response ~0,4 s): sem ultrapassar o alvo;
 *  - sempre a partir do valor ATUAL na tela, preservando a velocidade (interrompível);
 *  - qualquer gesto do usuário (arrastar, roda, tecla) cancela a animação imediatamente;
 *  - ao soltar um arraste rápido, a vista continua com a velocidade do dedo e desacelera
 *    exponencialmente (curva de projeção de momento da Apple, taxa 0,99 por ms: firme).
 * Com "reduzir movimento" ativado, a vista muda sem animação.
 */

let raf = 0;
let velocity = { x: 0, y: 0, k: 0 };

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function stopCamera() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/** Mola criticamente amortecida, integrada por quadro. `response` em segundos. */
export function animateView(target: View, response = 0.4) {
  stopCamera();
  const set = useApp.getState().setView;
  if (reducedMotion()) {
    velocity = { x: 0, y: 0, k: 0 };
    set(target);
    return;
  }
  const w = (2 * Math.PI) / response; // frequência natural
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    const cur = useApp.getState().view;
    const next: View = { ...cur };
    let settled = true;
    for (const key of ['x', 'y', 'k'] as const) {
      // integração semi-implícita de x'' = -w²(x - alvo) - 2w x'  (damping = 1)
      const disp = cur[key] - target[key];
      const acc = -w * w * disp - 2 * w * velocity[key];
      velocity[key] += acc * dt;
      next[key] = cur[key] + velocity[key] * dt;
      const tol = key === 'k' ? 0.0005 : 0.3;
      if (Math.abs(next[key] - target[key]) > tol || Math.abs(velocity[key]) > tol * 10) settled = false;
    }
    if (settled) {
      velocity = { x: 0, y: 0, k: 0 };
      set(target);
      raf = 0;
      return;
    }
    set(next);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Inércia após soltar um deslocamento: herda a velocidade (px/s) e desacelera. */
export function flingView(vx: number, vy: number, decelerationRate = 0.99) {
  // 0,99 = desaceleração "firme" (a de rolagem, 0,998, arremessaria o diagrama para fora da tela).
  // Distância percorrida ≈ (v/1000)·d/(1−d) ≈ 0,1·v px; velocidade limitada a 3000 px/s.
  stopCamera();
  const speed = Math.hypot(vx, vy);
  if (reducedMotion() || speed < 150) return;
  const cap = Math.min(1, 3000 / speed);
  let v = { x: (vx * cap) / 1000, y: (vy * cap) / 1000 }; // px/ms
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    const decay = Math.pow(decelerationRate, dt);
    const cur = useApp.getState().view;
    useApp.getState().setView({ ...cur, x: cur.x + v.x * dt, y: cur.y + v.y * dt });
    v = { x: v.x * decay, y: v.y * decay };
    if (Math.hypot(v.x, v.y) < 0.02) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Histórico curto de posições do ponteiro para estimar a velocidade na soltura. */
export class VelocityTracker {
  private samples: { x: number; y: number; t: number }[] = [];
  add(x: number, y: number, t = performance.now()) {
    this.samples.push({ x, y, t });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
  }
  /** Velocidade em px/s nos últimos ~100 ms (0 se o ponteiro parou antes de soltar). */
  velocity(now = performance.now()): { x: number; y: number } {
    const s = this.samples;
    if (s.length < 2 || now - s[s.length - 1].t > 60) return { x: 0, y: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt } : { x: 0, y: 0 };
  }
}

/** Zoom em torno de um ponto da tela, animado. */
export function zoomAround(factor: number, px: number, py: number) {
  const v = useApp.getState().view;
  const k = Math.max(0.2, Math.min(3, v.k * factor));
  animateView({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k }, 0.3);
}

/**
 * Move estados até posições-alvo com a mesma mola criticamente amortecida, como uma única
 * edição (uma entrada no desfazer). Usado ao soltar um arraste (assentar na grade) e no
 * "Organizar" (os estados viajam até o novo lugar em vez de teletransportar).
 */
let statesRaf = 0;
export function animateStatesTo(targets: Map<string, { x: number; y: number }>, response = 0.35, alreadyTransient = false) {
  const st = useApp.getState();
  if (statesRaf) cancelAnimationFrame(statesRaf);
  if (!alreadyTransient) st.beginTransient();
  const start = new Map(st.project.machine.states.filter((s) => targets.has(s.id)).map((s) => [s.id, { x: s.x, y: s.y }]));
  const finish = () => {
    statesRaf = 0;
    const s = useApp.getState();
    s.applyTransient((m) => ({ ...m, states: m.states.map((x) => (targets.has(x.id) ? { ...x, ...targets.get(x.id)! } : x)) }));
    s.endTransient();
  };
  if (reducedMotion()) return finish();
  const w = (2 * Math.PI) / response;
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = (now - t0) / 1000;
    // resposta ao degrau de uma mola criticamente amortecida, partindo do repouso
    const p = 1 - (1 + w * t) * Math.exp(-w * t);
    if (p > 0.999) return finish();
    useApp.getState().applyTransient((m) => ({
      ...m,
      states: m.states.map((x) => {
        const a = start.get(x.id);
        const b = targets.get(x.id);
        return a && b ? { ...x, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p } : x;
      }),
    }));
    statesRaf = requestAnimationFrame(tick);
  };
  statesRaf = requestAnimationFrame(tick);
}

/** Interrompe o movimento de estados onde estiver (valor atual) e registra a edição. */
export function stopStateMotion() {
  if (!statesRaf) return;
  cancelAnimationFrame(statesRaf);
  statesRaf = 0;
  useApp.getState().endTransient();
}
