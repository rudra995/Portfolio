// Which cursor-reactive layer sits on top of the molten metal base.
// 'splash-cursor' = React Bits SplashCursor (pure cursor-trail splashes, no ambient idle motion).
// 'liquid-ether'  = the previous full-screen fluid sim (ambient auto-demo + reacts to cursor).
// Flip this one line to roll back — liquid-ether.js is untouched and still fully wired below.
const LIQUID_LAYER = 'splash-cursor';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowViewport = window.matchMedia('(max-width: 640px)').matches;
const moltenEl = document.getElementById('bg-molten');
const liquidEl = document.getElementById('bg-liquid');

if (!reduced && !narrowViewport && moltenEl && liquidEl) {
  document.body.classList.add('has-webgl-bg');

  import('./molten-metal.js')
    .then(({ createMoltenMetal }) => {
      createMoltenMetal(moltenEl, {
        color1: '#141313',
        color2: '#8a3a22',
        color3: '#ff9a6b',
        speed: 0.28,
        scale: 4.5,
        detail: 3,
        glow: 1.5,
        coreSize: 0.11,
        swirl: 0.9,
        fold: -0.2,
        blackPoint: 0.05,
        brightness: 1.15,
        colorMode: 'ember',
        grain: true,
        grainIntensity: 0.045,
        mouseInteraction: true,
        mouseStrength: 0.25,
        opacity: 1
      });
    })
    .catch((err) => {
      console.warn('MoltenMetal background failed to load:', err);
      moltenEl.remove();
    });

  if (LIQUID_LAYER === 'splash-cursor') {
    import('./splash-cursor.js')
      .then(({ createSplashCursor }) => {
        liquidEl.style.position = 'fixed';
        createSplashCursor(liquidEl, {
          SIM_RESOLUTION: 128,
          DYE_RESOLUTION: 1024,
          DENSITY_DISSIPATION: 3.5,
          VELOCITY_DISSIPATION: 2,
          PRESSURE: 0.1,
          PRESSURE_ITERATIONS: 20,
          CURL: 3,
          SPLAT_RADIUS: 0.25,
          SPLAT_FORCE: 6000,
          SHADING: true,
          TRANSPARENT: true,
          RAINBOW_MODE: false,
          COLOR: '#dd5e3f'
        });
      })
      .catch((err) => {
        console.warn('SplashCursor background failed to load:', err);
        liquidEl.remove();
      });
  } else {
    import('./liquid-ether.js')
      .then(({ createLiquidEther }) => {
        // liquid-ether.js sets container.style.position only when it's empty; pre-set it so
        // that fallback doesn't clobber the fixed full-viewport layout from .site-bg-layer.
        liquidEl.style.position = 'fixed';
        createLiquidEther(liquidEl, {
          colors: ['#000000', '#f97316', '#eab308'],
          mouseForce: 32,
          cursorSize: 100,
          resolution: 0.5,
          isBounce: false,
          isViscous: true,
          viscous: 41,
          iterationsViscous: 32,
          iterationsPoisson: 32,
          autoDemo: true,
          autoSpeed: 0.6,
          autoIntensity: 2.2,
          takeoverDuration: 0.3,
          autoResumeDelay: 900,
          autoRampDuration: 0.5
        });
      })
      .catch((err) => {
        console.warn('LiquidEther background failed to load:', err);
        liquidEl.remove();
      });
  }
} else if (moltenEl && liquidEl) {
  moltenEl.remove();
  liquidEl.remove();
}
