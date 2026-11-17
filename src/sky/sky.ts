// The living sky: a WebGL shader background driven by real sun position and weather,
// with a 2D particle layer for precipitation and lightning.
import { VERT, FRAG } from './shader';
import { palette } from './palette';
import { Precip } from './precip';
import type { SkyWeather } from '../lib/codes';

export interface SkyTarget {
  sunElev: number;
  sunAz: number;
  lat: number;
  moonPhase: number;
  weather: SkyWeather;
  windKmh: number;
  windDir: number;
  snowGround: number;
}

type Num = Record<string, number>;

const FIELDS = ['sunElev', 'sunX', 'cloud', 'dark', 'fog', 'intensity', 'windX', 'moonPhase', 'snowGround'] as const;

export class Sky {
  private gl: WebGLRenderingContext | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private cur: Num = {};
  private tgt: Num = {};
  private precip: Precip;
  private lat = 51;
  private thunder = false;
  private nextStrike = 0;
  private flash = 0;
  private time = Math.random() * 1000;
  private last = performance.now();
  private parallax = { x: 0, y: 0 };
  private drift = 0; // integrated cloud drift, so wind changes never jump the clouds
  private scale = 0.6;
  private raf = 0;
  motion = 1;
  /** 0..1 how bright the sky is behind the hero, for text contrast */
  get brightness() {
    const night = palette(this.tgt.sunElev ?? 0).night;
    return (1 - night) * Math.min(1, 0.55 + 0.45 * Math.max(this.tgt.cloud ?? 0, this.tgt.fog ?? 0) + Math.max(0, (this.tgt.sunElev ?? 0) / 90));
  }
  onFrame?: () => void;

  constructor(private glCanvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement) {
    this.precip = new Precip(fxCanvas);
    this.initGL();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(this.raf);
      else { this.last = performance.now(); this.loop(); }
    });
    this.resize();
  }

  private initGL() {
    const gl = this.glCanvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) { document.documentElement.classList.add('no-webgl'); return; }
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    try {
      const p = gl.createProgram()!;
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
      gl.useProgram(p);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const name of ['uRes', 'uTime', 'uZenith', 'uHorizon', 'uSunCol', 'uCloudLit', 'uCloudShade', 'uSun', 'uSunVis', 'uMoon', 'uMoonVis',
        'uMoonPhase', 'uMoonFlip', 'uNight', 'uCloud', 'uDark', 'uFog', 'uFlash', 'uWind', 'uParallax', 'uSnowGround']) {
        this.u[name] = gl.getUniformLocation(p, name);
      }
      this.gl = gl;

    } catch (e) {
      console.warn('Sky shader unavailable', e);
      document.documentElement.classList.add('no-webgl');
    }
  }

  private resize() {
    const w = innerWidth, h = innerHeight;
    // Keep the shader around ~1.1 MP; the sky is soft so this is invisible.
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.scale = Math.min(dpr, Math.sqrt(1_100_000 / (w * h)));
    this.glCanvas.width = Math.round(w * this.scale);
    this.glCanvas.height = Math.round(h * this.scale);
    this.precip.resize(w, h);
    this.gl?.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
  }

  set(t: SkyTarget, instant = false) {
    this.lat = t.lat;
    // Viewer faces the equator: south in the northern hemisphere, north in the southern.
    const facing = t.lat >= 0 ? 180 : 0;
    let d = t.sunAz - facing;
    d = ((d + 540) % 360) - 180;
    const sunX = Math.max(-0.35, Math.min(1.35, 0.5 + d / 220));
    // Wind blows *from* windDir; on screen east is left when facing south.
    const toward = Math.sin((t.windDir * Math.PI) / 180) * (t.lat >= 0 ? 1 : -1);
    const w = t.weather;
    Object.assign(this.tgt, {
      sunElev: t.sunElev,
      sunX,
      cloud: w.cloud,
      dark: w.dark,
      fog: w.fog,
      intensity: w.intensity,
      windX: toward * Math.min(t.windKmh, 80),
      moonPhase: t.moonPhase,
      snowGround: t.snowGround,
    });
    if (this.precip.type !== w.precip) this.precip.reset();
    this.precip.type = w.precip;
    this.thunder = w.thunder;
    if (instant || !('sunElev' in this.cur)) Object.assign(this.cur, this.tgt);
    // Below the horizon the sun swings round behind the viewer; snap instead of sweeping across.
    else if (Math.abs(this.cur.sunX - sunX) > 0.5 && t.sunElev < -2 && this.cur.sunElev < -2) this.cur.sunX = sunX;
    if (!this.raf) this.loop();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt * this.motion;

    const k = 1 - Math.exp(-dt * 2.2);
    for (const f of FIELDS) {
      if (f === 'moonPhase') { this.cur[f] = this.tgt[f]; continue; }
      this.cur[f] += (this.tgt[f] - this.cur[f]) * k;
    }
    // Slow ambient camera drift: the hills glide back and forth on a long loop.
    const tt = this.time;
    this.parallax.x = Math.sin(tt * 0.07) * 1.6 + Math.sin(tt * 0.027 + 1.7) * 1.0;
    this.parallax.y = Math.sin(tt * 0.021) * 0.5;
    this.drift += ((this.cur.windX / 80) * 0.06 + 0.004) * dt * this.motion;

    // Lightning
    if (this.thunder && this.motion > 0.5) {
      if (now > this.nextStrike) {
        this.flash = 1;
        if (Math.random() < 0.55) this.precip.strike();
        this.nextStrike = now + 3500 + Math.random() * 9000;
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.6);
    const flash = this.flash > 0 ? this.flash * (0.6 + 0.4 * Math.sin(now * 0.09)) : 0;

    this.precip.intensity = this.cur.intensity * (this.motion < 0.5 ? 0.4 : 1);
    this.precip.windX = this.cur.windX * 6;
    this.precip.frame(dt, this.motion < 0.5 ? 0.35 : 1);

    this.draw(flash);
    this.onFrame?.();
  };

  private draw(flash: number) {
    const gl = this.gl;
    if (!gl) return;
    const c = this.cur;
    const pal = palette(c.sunElev);
    const set3 = (n: string, v: number[]) => gl.uniform3f(this.u[n], v[0], v[1], v[2]);
    gl.uniform2f(this.u.uRes, this.glCanvas.width, this.glCanvas.height);
    gl.uniform1f(this.u.uTime, this.time);
    set3('uZenith', pal.zenith);
    set3('uHorizon', pal.horizon);
    set3('uSunCol', pal.sun);
    set3('uCloudLit', pal.cloudLit);
    set3('uCloudShade', pal.cloudShade);
    const H = 0.24;
    const sunY = Math.min(0.84, H + Math.sin((Math.max(-10, c.sunElev) * Math.PI) / 180) * 0.95);
    gl.uniform2f(this.u.uSun, c.sunX, sunY);
    gl.uniform1f(this.u.uSunVis, Math.min(1, Math.max(0, (c.sunElev + 1.5) / 3)));
    // Moon: placed opposite-ish to the sun, high in the night sky.
    const moonVis = pal.night > 0 ? Math.min(1, pal.night * 1.6) : 0;
    const portrait = this.glCanvas.height > this.glCanvas.width;
    gl.uniform2f(this.u.uMoon, portrait ? 0.78 : 0.76, portrait ? 0.84 : 0.74);
    gl.uniform1f(this.u.uMoonVis, moonVis);
    gl.uniform1f(this.u.uMoonPhase, c.moonPhase);
    gl.uniform1f(this.u.uMoonFlip, this.lat >= 0 ? 1 : -1);
    gl.uniform1f(this.u.uNight, pal.night);
    gl.uniform1f(this.u.uCloud, c.cloud);
    gl.uniform1f(this.u.uDark, c.dark);
    gl.uniform1f(this.u.uFog, c.fog);
    gl.uniform1f(this.u.uFlash, flash);
    gl.uniform2f(this.u.uWind, this.drift, 0.0);
    gl.uniform2f(this.u.uParallax, this.parallax.x, this.parallax.y);
    gl.uniform1f(this.u.uSnowGround, c.snowGround);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
