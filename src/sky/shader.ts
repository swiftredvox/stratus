export const VERT = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunCol;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec2 uSun;        // uv
uniform float uSunVis;    // 0..1 sun above horizon
uniform vec2 uMoon;       // uv
uniform float uMoonVis;
uniform float uMoonPhase;
uniform float uMoonFlip;  // 1 northern, -1 southern
uniform float uNight;     // 0..1
uniform float uCloud;     // 0..1 coverage
uniform float uDark;      // 0..1 storminess
uniform float uFog;       // 0..1
uniform float uFlash;     // lightning
uniform vec2 uWind;       // accumulated cloud drift offset
uniform vec2 uParallax;
uniform float uSnowGround;

const float H = 0.24; // horizon height

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = r * p * 2.1 + 3.1; a *= 0.5; }
  return v;
}

float ridge(float x, float seed, float freq) {
  float v = 0.0, a = 0.5;
  x = x * freq + seed;
  for (int i = 0; i < 4; i++) { v += a * noise(vec2(x, seed)); x *= 2.1; a *= 0.48; }
  return v;
}

vec3 desat(vec3 c, float k) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(c, vec3(l), k); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime;
  float overcast = smoothstep(0.55, 1.0, uCloud);

  // ---- Sky gradient
  float hy = uv.y - H;
  float g = clamp(hy / (1.0 - H), 0.0, 1.0);
  vec3 sky = mix(uHorizon, uZenith, pow(g, 0.55));
  // Warm scattering around the sun
  vec2 sp = vec2(uSun.x * aspect, uSun.y);
  float sd = length(p - sp);
  float mie = exp(-sd * 3.2) * (1.0 - uNight) ;
  sky += uSunCol * mie * 0.38 * (1.0 - overcast * 0.8);
  // Overcast flattens and greys the sky
  float grey = overcast * (0.55 + 0.35 * uDark);
  sky = mix(sky, desat(mix(uHorizon, uZenith, 0.5), 0.85) * (1.0 - 0.45 * uDark), grey);

  // ---- Stars
  float starMask = uNight * (1.0 - smoothstep(0.35, 0.9, uCloud)) * smoothstep(0.0, 0.25, hy);
  if (starMask > 0.001) {
    vec2 sg = p * vec2(140.0, 140.0);
    vec2 id = floor(sg);
    float h = hash(id);
    if (h > 0.975) {
      vec2 c = fract(sg) - 0.5 - (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
      float tw = 0.6 + 0.4 * sin(t * (1.0 + h * 3.0) + h * 40.0);
      float s = smoothstep(0.13, 0.0, length(c)) * tw * (0.35 + 0.65 * (h - 0.975) / 0.025);
      sky += mix(vec3(1.0, 0.85, 0.7), vec3(0.8, 0.88, 1.0), hash(id + 1.3)) * s * starMask * 1.6;
    }
    // faint milky band
    float band = exp(-pow((uv.y - 0.85 + uv.x * 0.35) * 4.0, 2.0)) * fbm3(p * 3.0);
    sky += vec3(0.25, 0.28, 0.4) * band * 0.22 * starMask;
    // airglow along the horizon
    sky += vec3(0.05, 0.07, 0.13) * exp(-max(hy, 0.0) * 9.0) * uNight;
  }

  // ---- Sun disc
  float sunR = 0.034;
  float disc = smoothstep(sunR, sunR * 0.82, sd);
  float halo = exp(-sd * 14.0) * 0.6 + exp(-sd * 40.0) * 0.6;
  // Behind thick cloud the disc fades out entirely, leaving only a diffuse bright patch (added after the clouds).
  float sunThrough = 1.0 - smoothstep(0.0, 0.85, overcast);
  sky += (uSunCol * 1.6 * disc + uSunCol * halo) * uSunVis * sunThrough;

  // ---- Moon
  vec2 mp = vec2(uMoon.x * aspect, uMoon.y);
  vec2 md = (p - mp);
  float moonR = 0.028;
  float mlen = length(md);
  if (uMoonVis > 0.001) {
    float glow = exp(-mlen * 18.0) * 0.35 + exp(-mlen * 5.0) * 0.08;
    float lit = 0.0;
    if (mlen < moonR * 1.05) {
      vec2 q = md / moonR;
      q.x *= uMoonFlip;
      float k = cos(uMoonPhase * 6.2831853);
      float w = sqrt(max(0.0, 1.0 - q.y * q.y));
      float edge = 0.04;
      if (uMoonPhase < 0.5) lit = smoothstep(k * w - edge, k * w + edge, q.x);
      else lit = smoothstep(-k * w + edge, -k * w - edge, q.x);
      float tex = 0.82 + 0.18 * fbm3(q * 3.0 + 5.0);
      float diskA = smoothstep(1.0, 0.94, length(q));
      vec3 moonCol = vec3(0.93, 0.92, 0.86) * tex;
      vec3 shadow = sky * 0.7 + vec3(0.02, 0.025, 0.04); // earthshine
      sky = mix(sky, mix(shadow, moonCol, lit), diskA * uMoonVis * (1.0 - overcast * 0.85));
    }
    float illum = (1.0 - cos(uMoonPhase * 6.2831853)) * 0.5;
    sky += vec3(0.7, 0.75, 0.9) * glow * uMoonVis * (0.3 + illum) * (1.0 - overcast * 0.7);
  }

  // ---- Clouds (perspective plane converging to horizon)
  if (hy > 0.0) {
    float depth = 1.0 / (hy + 0.1);
    vec2 cp = vec2((uv.x - 0.5) * aspect * depth * 0.9, depth * 1.6);
    vec2 drift = uWind;

    // High cirrus
    vec2 ci = cp * vec2(0.35, 1.4) - drift * 0.6 + vec2(31.0, 7.0);
    float cir = fbm3(ci + fbm3(ci * 0.5) * 1.5);
    float cirA = smoothstep(0.55, 0.85, cir) * 0.35 * (1.0 - overcast) * smoothstep(0.02, 0.3, uCloud + 0.15);

    // Main layer
    vec2 q = cp * 0.55 - drift;
    float warp = fbm3(q * 0.6 + t * 0.01);
    float n = fbm(q + warp * 0.8);
    float cov = mix(0.72, 0.18, uCloud);
    float dens = smoothstep(cov, cov + 0.28 - 0.12 * uCloud, n);
    // light from the sun / moon direction: sample towards the light
    // Offset towards the light, shrinking smoothly near the sun so there's no pinch point.
    vec2 toSun = vec2((uSun.x - uv.x) * aspect, uSun.y - uv.y);
    vec2 ldir = toSun / max(length(toSun), 0.35);
    float n2 = fbm(q + warp * 0.8 + ldir * 0.09);
    float shade = clamp((n - n2) * 4.0 + 0.55, 0.0, 1.0);
    float underside = smoothstep(cov, cov + 0.5, n); // thicker → darker base
    vec3 lit = uCloudLit;
    vec3 sh = uCloudShade * (1.0 - 0.55 * uDark);
    vec3 ccol = mix(sh, lit, shade * (1.0 - underside * (0.35 + 0.5 * uDark)));
    // silver lining near the sun
    ccol += uSunCol * exp(-sd * 6.0) * (1.0 - dens) * 1.2 * uSunVis * (1.0 - overcast);
    ccol = mix(ccol, ccol * 0.55, uDark * 0.6);
    ccol += vec3(0.75, 0.8, 1.0) * uFlash * (0.6 + 0.8 * dens);

    float fadeH = smoothstep(0.0, 0.18, hy);
    float a = dens * fadeH;
    a = mix(a, max(a, 0.92 * fadeH + 0.08), overcast * 0.85);
    sky = mix(sky, mix(lit, uCloudShade, 0.3) * 0.98, cirA * fadeH);
    sky = mix(sky, ccol, clamp(a, 0.0, 1.0));
  }
  sky += vec3(0.5, 0.55, 0.75) * uFlash * 0.35;
  // Sun glowing faintly through cloud
  if (hy > 0.0) sky += uSunCol * (exp(-sd * 3.5) * 0.16 + exp(-sd * 9.0) * 0.08) * uSunVis * overcast * (1.0 - 0.8 * uDark);

  // ---- Distant hills (three layers, aerial perspective)
  vec3 col = sky;
  vec3 hazeCol = mix(uHorizon, desat(uHorizon, 0.6), overcast);
  float px = uv.x * aspect;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float par = (fi + 1.0) * (fi + 1.0) * 0.01;
    float x = px + uParallax.x * par;
    float hgt = H - 0.05 - fi * 0.06 + ridge(x, 3.7 + fi * 17.3, 1.4 + fi * 0.9) * (0.08 + fi * 0.035);
    float m = smoothstep(hgt + 0.0015, hgt - 0.0015, uv.y);
    float near = (fi + 1.0) / 3.0;
    vec3 base = mix(hazeCol * 0.85, uZenith * 0.25 + vec3(0.01, 0.012, 0.02), near * 0.85);
    base = mix(base, base * 0.5, uNight * near);
    // soft rim light from sky
    float rim = smoothstep(hgt - 0.02, hgt, uv.y) * 0.12 * (1.0 - uNight);
    base += uHorizon * rim;
    // snow-covered land: paler overall, brighter towards the crest
    vec3 snowCol = mix(vec3(0.78, 0.82, 0.9), uHorizon, 0.35) * (1.0 - 0.75 * uNight);
    base = mix(base, snowCol * (0.75 + 0.25 * smoothstep(hgt - 0.08, hgt, uv.y)), uSnowGround * (0.55 - near * 0.25));
    base *= 1.0 - 0.3 * uDark;
    // fog swallows farther ridges more
    base = mix(base, hazeCol, uFog * (1.0 - near * 0.5));
    col = mix(col, base, m);
  }

  // ---- Fog / mist
  float fogH = exp(-max(uv.y - 0.05, 0.0) * 3.0);
  vec3 fogCol = mix(desat(uHorizon, 0.7) * 1.05, vec3(0.06, 0.07, 0.1), uNight * 0.6);
  float fn = fbm3(vec2(uv.x * aspect * 2.0 + t * 0.02, uv.y * 4.0));
  col = mix(col, fogCol, clamp(uFog * (0.35 + 0.65 * fogH) * (0.75 + 0.4 * fn), 0.0, 0.95));

  // ---- Soft highlight roll-off (no hard clipping into flat blobs)
  vec3 over = max(col - 0.72, 0.0);
  col = min(col, 0.72) + 0.28 * (1.0 - exp(-over / 0.28));

  // ---- Vignette + dither
  vec2 vc = uv - 0.5;
  col *= 1.0 - dot(vc, vc) * 0.35;
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
