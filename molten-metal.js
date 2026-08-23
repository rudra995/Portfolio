// Vanilla WebGL2 port of React Bits' MoltenMetal background (github.com/DavidHDev/react-bits).
// Shaders are verbatim from the source; only the mount/render scaffolding (originally `ogl` +
// React hooks) has been replaced with plain WebGL2 + DOM APIs so this runs with no dependencies.

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
};

const colorModeToFloat = (mode) => (mode === 'ember' ? 1 : mode === 'frost' ? 2 : 0);

const VERTEX_SRC = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uScale;
uniform float uDetail;
uniform float uGlow;
uniform float uCoreSize;
uniform float uSwirl;
uniform float uFold;
uniform float uBlackPoint;
uniform float uBrightness;
uniform float uColorMode;
uniform float uGrain;
uniform float uGrainIntensity;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform bool uEnableMouse;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float time = iTime * uSpeed;
  vec2 p = uScale * ((gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y) - 0.5;

  vec2 drift = vec2(0.0);
  if (uEnableMouse) {
    drift = (uMouse - 0.5) * uMouseStrength * 2.0;
  }
  p += drift;

  vec2 i = p;
  float c = 0.0;
  float r = length(p + vec2(sin(time), sin(time * 0.3 + 5.0)) * 0.5);
  float d = length(p);
  float rot = d + time + p.x * uSwirl;

  float cosRot = cos(rot);
  mat2 warp = mat2(cos(rot - sin(time / 5.0)), sin(rot), -sin(cosRot - time), cosRot) * uFold;
  float glowCore = uGlow * uCoreSize;

  for (float n = 0.0; n < 8.0; n++) {
    if (n >= uDetail) break;
    p *= warp;
    float t = r - time / (n + 3.0);
    i -= p + vec2(cos(t - i.x - r) + sin(t + i.y), sin(t - i.y) + cos(t + i.x) + r);
    c += glowCore / length(vec2(sin(i.x + t), cos(i.y + t)));
  }

  c /= 6.0;

  float intensity = max(c - uBlackPoint, 0.0) * uBrightness;

  float g = clamp(intensity, 0.0, 1.0);

  float mid = 0.5;
  if (uColorMode > 1.5) {
    mid = 0.65;
  } else if (uColorMode > 0.5) {
    mid = 0.35;
  }

  vec3 col = mix(uColor1, uColor2, smoothstep(0.0, mid, g));
  col = mix(col, uColor3, smoothstep(mid, 1.0, g));

  float a = g;
  if (uGrain > 0.5) {
    float gr = hash(gl_FragCoord.xy + iTime);
    a += (gr - 0.5) * uGrainIntensity;
  }
  a = clamp(a, 0.0, 1.0) * uOpacity;
  fragColor = vec4(col * a, a);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('MoltenMetal shader compile error: ' + info);
  }
  return shader;
}

function createProgram(gl, vertexSrc, fragmentSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('MoltenMetal program link error: ' + info);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

export function createMoltenMetal(container, options = {}) {
  if (!container) return () => {};
  const opts = {
    color1: '#5227FF',
    color2: '#FF9FFC',
    color3: '#FFFFFF',
    speed: 0.35,
    scale: 4,
    detail: 3,
    glow: 1.6,
    coreSize: 0.1,
    swirl: 1,
    fold: -0.2,
    blackPoint: 0.05,
    brightness: 1.3,
    colorMode: 'molten',
    grain: true,
    grainIntensity: 0.05,
    mouseInteraction: true,
    mouseStrength: 0.3,
    opacity: 1.0,
    ...options
  };

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) {
    container.removeChild(canvas);
    return () => {};
  }
  gl.clearColor(0, 0, 0, 0);

  const program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
  gl.useProgram(program);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle larger than clip space covers the viewport without a wasted diagonal seam.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const positionLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const u = (name) => gl.getUniformLocation(program, name);
  const uniforms = {
    iTime: u('iTime'),
    iResolution: u('iResolution'),
    uSpeed: u('uSpeed'),
    uScale: u('uScale'),
    uDetail: u('uDetail'),
    uGlow: u('uGlow'),
    uCoreSize: u('uCoreSize'),
    uSwirl: u('uSwirl'),
    uFold: u('uFold'),
    uBlackPoint: u('uBlackPoint'),
    uBrightness: u('uBrightness'),
    uColorMode: u('uColorMode'),
    uGrain: u('uGrain'),
    uGrainIntensity: u('uGrainIntensity'),
    uOpacity: u('uOpacity'),
    uMouse: u('uMouse'),
    uMouseStrength: u('uMouseStrength'),
    uEnableMouse: u('uEnableMouse'),
    uColor1: u('uColor1'),
    uColor2: u('uColor2'),
    uColor3: u('uColor3')
  };

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const setSize = () => {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(program);
    gl.uniform2f(uniforms.iResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
  };

  const ro = new ResizeObserver(setSize);
  ro.observe(container);
  setSize();

  const targetMouse = [0.5, 0.5];
  const currentMouse = [0.5, 0.5];

  const handleMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    targetMouse[0] = (e.clientX - rect.left) / rect.width;
    targetMouse[1] = 1.0 - (e.clientY - rect.top) / rect.height;
  };
  const handleMouseLeave = () => {
    targetMouse[0] = 0.5;
    targetMouse[1] = 0.5;
  };
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseleave', handleMouseLeave);

  const c1 = hexToRgb(opts.color1);
  const c2 = hexToRgb(opts.color2);
  const c3 = hexToRgb(opts.color3);

  gl.useProgram(program);
  gl.uniform1f(uniforms.uSpeed, opts.speed);
  gl.uniform1f(uniforms.uScale, opts.scale);
  gl.uniform1f(uniforms.uDetail, opts.detail);
  gl.uniform1f(uniforms.uGlow, opts.glow);
  gl.uniform1f(uniforms.uCoreSize, Math.max(opts.coreSize, 0.001));
  gl.uniform1f(uniforms.uSwirl, opts.swirl);
  gl.uniform1f(uniforms.uFold, opts.fold);
  gl.uniform1f(uniforms.uBlackPoint, opts.blackPoint);
  gl.uniform1f(uniforms.uBrightness, opts.brightness);
  gl.uniform1f(uniforms.uColorMode, colorModeToFloat(opts.colorMode));
  gl.uniform1f(uniforms.uGrain, opts.grain ? 1 : 0);
  gl.uniform1f(uniforms.uGrainIntensity, opts.grainIntensity);
  gl.uniform1f(uniforms.uOpacity, opts.opacity);
  gl.uniform1f(uniforms.uMouseStrength, opts.mouseStrength);
  gl.uniform1i(uniforms.uEnableMouse, opts.mouseInteraction ? 1 : 0);
  gl.uniform3f(uniforms.uColor1, c1[0], c1[1], c1[2]);
  gl.uniform3f(uniforms.uColor2, c2[0], c2[1], c2[2]);
  gl.uniform3f(uniforms.uColor3, c3[0], c3[1], c3[2]);

  let raf = 0;
  let isVisible = true;
  let isPageVisible = !document.hidden;
  const t0 = performance.now();

  const loop = (t) => {
    gl.useProgram(program);
    gl.uniform1f(uniforms.iTime, (t - t0) * 0.001);
    currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
    currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
    gl.uniform2f(uniforms.uMouse, currentMouse[0], currentMouse[1]);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(loop);
  };

  const tryStart = () => {
    if (isVisible && isPageVisible && raf === 0) raf = requestAnimationFrame(loop);
  };
  const tryStop = () => {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
      isVisible ? tryStart() : tryStop();
    },
    { threshold: 0 }
  );
  io.observe(container);

  const onVisibility = () => {
    isPageVisible = !document.hidden;
    isPageVisible ? tryStart() : tryStop();
  };
  document.addEventListener('visibilitychange', onVisibility);

  tryStart();

  return function dispose() {
    tryStop();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mouseleave', handleMouseLeave);
    try {
      container.removeChild(canvas);
    } catch (e) {}
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  };
}
