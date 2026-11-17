// Rain, snow and lightning bolts on a 2D canvas layered above the shader sky.
import type { PrecipType } from '../lib/codes';

interface Drop { x: number; y: number; z: number; v: number; len: number; phase: number; snow: boolean }

export class Precip {
  private ctx: CanvasRenderingContext2D;
  private drops: Drop[] = [];
  private w = 0;
  private h = 0;
  type: PrecipType = 'none';
  intensity = 0;
  windX = 0; // px/s horizontal drift at full depth
  private bolt: { pts: [number, number][]; branches: [number, number][][]; life: number } | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
  }

  private target(): number {
    if (this.type === 'none') return 0;
    const area = (this.w * this.h) / (1440 * 900);
    const base = this.type === 'snow' ? 260 : 420;
    return Math.round(base * this.intensity * Math.min(area, 2.2));
  }

  private spawn(randomY: boolean): Drop {
    const z = Math.random() * 0.8 + 0.2; // depth: 1 = near
    const snow = this.type === 'snow' || (this.type === 'sleet' && Math.random() < 0.5);
    return {
      x: Math.random() * (this.w + 200) - 100,
      y: randomY ? Math.random() * this.h : -20 - Math.random() * 60,
      z,
      v: snow ? 30 + 70 * z : 700 + 700 * z,
      len: snow ? 0.8 + 2.4 * z : 10 + 18 * z,
      phase: Math.random() * Math.PI * 2,
      snow,
    };
  }

  reset() { this.drops = []; }

  strike() {
    // Jagged bolt from the cloud base down towards the horizon.
    const x0 = this.w * (0.15 + Math.random() * 0.7);
    const pts: [number, number][] = [[x0, this.h * 0.05]];
    const branches: [number, number][][] = [];
    let x = x0, y = this.h * 0.05;
    const end = this.h * (0.55 + Math.random() * 0.2);
    while (y < end) {
      y += 12 + Math.random() * 26;
      x += (Math.random() - 0.5) * 40;
      pts.push([x, y]);
      if (Math.random() < 0.12) {
        const br: [number, number][] = [[x, y]];
        let bx = x, by = y;
        const dir = Math.random() < 0.5 ? -1 : 1;
        for (let i = 0; i < 4 + Math.random() * 5; i++) { bx += dir * (8 + Math.random() * 22); by += 10 + Math.random() * 20; br.push([bx, by]); }
        branches.push(br);
      }
    }
    this.bolt = { pts, branches, life: 1 };
  }

  frame(dt: number, motion: number) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    const want = this.target();
    if (this.drops.length < want) {
      const initial = this.drops.length === 0;
      const add = Math.min(want - this.drops.length, initial ? want : Math.ceil(want * dt * 1.5) + 1);
      for (let i = 0; i < add; i++) this.drops.push(this.spawn(initial));
    }
    const step = dt * motion;
    let remove = this.drops.length - want;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.y += d.v * step;
      d.x += this.windX * d.z * step * (d.snow ? 0.5 : 1);
      if (d.snow) d.x += Math.sin(d.phase + d.y * 0.02) * 12 * step;
      if (d.y > this.h + 30 || d.x < -150 || d.x > this.w + 150) {
        if (remove > 0) { this.drops.splice(i, 1); remove--; continue; }
        Object.assign(d, this.spawn(false));
      }
    }

    // rain
    const slant = this.windX / 1000;
    ctx.lineCap = 'round';
    for (const d of this.drops) {
      if (d.snow) continue;
      const a = 0.12 + 0.28 * d.z;
      ctx.strokeStyle = `rgba(200,215,240,${a})`;
      ctx.lineWidth = 0.6 + d.z * 0.9;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - slant * d.len, d.y - d.len);
      ctx.stroke();
    }
    // snow
    for (const d of this.drops) {
      if (!d.snow) continue;
      ctx.fillStyle = `rgba(245,248,255,${0.35 + 0.55 * d.z})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.bolt) {
      const b = this.bolt;
      b.life -= dt * 3.2;
      if (b.life <= 0) this.bolt = null;
      else {
        const flick = b.life > 0.6 || (b.life > 0.25 && b.life < 0.45) ? 1 : 0.35;
        const draw = (pts: [number, number][], w: number) => {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (const p of pts) ctx.lineTo(p[0], p[1]);
          ctx.stroke();
          void w;
        };
        ctx.save();
        ctx.shadowColor = 'rgba(170,190,255,0.9)';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = `rgba(235,240,255,${b.life * flick})`;
        ctx.lineWidth = 2.2;
        draw(b.pts, 2.2);
        ctx.lineWidth = 1;
        b.branches.forEach((br) => draw(br, 1));
        ctx.restore();
      }
    }
  }

  get active() { return this.drops.length > 0 || !!this.bolt; }
}
