// Vanilla port of React Bits' Lanyard: a physics-simulated ID card on a rope band
// (Three.js + Rapier physics + MeshLine), rebuilt without React/R3F/@react-three/rapier.
// Card model + band texture are React Bits' own assets, fetched once and stored locally
// in assets/lanyard/. The joint/segment constants and per-frame math below are copied
// verbatim from the source Band component so the physical behavior matches exactly.
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshLineGeometry, MeshLineMaterial } from 'https://esm.sh/meshline@3.3.1?external=three';
import * as RAPIER from 'https://esm.sh/@dimforge/rapier3d-compat@0.14.0';

const CARD_GLB_URL = 'assets/lanyard/card.glb';
const BAND_TEXTURE_URL = 'assets/lanyard/lanyard-band.png';

const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.755 };
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.757 };

const MIN_SPEED = 0;
const MAX_SPEED = 50;
const GROUP_Y = 4;

function loadImageEl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function compositeCardTexture(baseMap, frontUrl, backUrl, imageFit) {
  const baseImg = baseMap.image;
  const W = baseImg.width, H = baseImg.height;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(baseImg, 0, 0, W, H);

  const drawFitted = (img, rect) => {
    const rx = rect.x * W, ry = rect.y * H, rw = rect.w * W, rh = rect.h * H;
    const pick = imageFit === 'contain' ? Math.min : Math.max;
    const scale = pick(rw / img.width, rh / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    const dx = rx + (rw - dw) / 2, dy = ry + (rh - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  };

  if (frontUrl) drawFitted(await loadImageEl(frontUrl), FRONT_UV_RECT);
  if (backUrl) drawFitted(await loadImageEl(backUrl), BACK_UV_RECT);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = baseMap.flipY;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

function buildEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const lightformer = (color, intensity, position, rotation, scale) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    envScene.add(mesh);
  };
  lightformer('white', 2, [0, -1, 5], [0, 0, Math.PI / 3], [100, 0.1, 1]);
  lightformer('white', 3, [-1, -1, 1], [0, 0, Math.PI / 3], [100, 0.1, 1]);
  lightformer('white', 3, [1, 1, 1], [0, 0, Math.PI / 3], [100, 0.1, 1]);
  lightformer('white', 10, [-10, 0, 14], [0, Math.PI / 2, Math.PI / 3], [100, 10, 1]);
  const renderTarget = pmrem.fromScene(envScene, 0.4);
  scene.environment = renderTarget.texture;
  envScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  pmrem.dispose();
}

export async function createLanyard(container, opts = {}) {
  const {
    frontImage = null,
    backImage = null,
    imageFit = 'cover',
    lanyardWidth = 1,
    gravity = [0, -40, 0],
    fov = 20,
    cameraPosition = [0, 0, 30]
  } = opts;

  const isMobile = window.innerWidth < 768;

  await RAPIER.init();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 1000);
  camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'pan-y';
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
  buildEnvironment(renderer, scene);

  const world = new RAPIER.World({ x: gravity[0], y: gravity[1], z: gravity[2] });
  world.timestep = isMobile ? 1 / 30 : 1 / 60;

  const gltfLoader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();

  const [gltf, bandTex] = await Promise.all([
    gltfLoader.loadAsync(CARD_GLB_URL),
    textureLoader.loadAsync(BAND_TEXTURE_URL)
  ]);
  bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping;

  const nodes = {};
  const materials = {};
  gltf.scene.traverse((obj) => {
    if (obj.name) nodes[obj.name] = obj;
    if (obj.material && obj.material.name && !materials[obj.material.name]) materials[obj.material.name] = obj.material;
  });

  let cardMap = materials.base.map;
  if (frontImage || backImage) {
    cardMap = await compositeCardTexture(materials.base.map, frontImage, backImage, imageFit);
  }

  const fixedBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, GROUP_Y, 0));

  const makeDynamic = (x, y, z) =>
    world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCanSleep(true)
        .setLinearDamping(4)
        .setAngularDamping(4)
    );

  // Start the chain bunched at the anchor (instead of the resting spread) so gravity
  // visibly drops + unfurls it into its hanging curve once mounted, using the exact
  // same joints/solver as the settled state — only the initial pose differs.
  const j1Body = makeDynamic(0.02, GROUP_Y, 0);
  const j2Body = makeDynamic(0.04, GROUP_Y, 0);
  const j3Body = makeDynamic(0.06, GROUP_Y, 0);
  const cardBody = makeDynamic(0.08, GROUP_Y, 0);

  world.createCollider(RAPIER.ColliderDesc.ball(0.1), j1Body);
  world.createCollider(RAPIER.ColliderDesc.ball(0.1), j2Body);
  world.createCollider(RAPIER.ColliderDesc.ball(0.1), j3Body);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.8, 1.125, 0.01), cardBody);

  const zero = { x: 0, y: 0, z: 0 };
  world.createImpulseJoint(RAPIER.JointData.rope(1, zero, zero), fixedBody, j1Body, true);
  world.createImpulseJoint(RAPIER.JointData.rope(1, zero, zero), j1Body, j2Body, true);
  world.createImpulseJoint(RAPIER.JointData.rope(1, zero, zero), j2Body, j3Body, true);
  world.createImpulseJoint(RAPIER.JointData.spherical(zero, { x: 0, y: 1.5, z: 0 }), j3Body, cardBody, true);

  materials.metal.roughness = 0.3;

  const cardMaterial = new THREE.MeshPhysicalMaterial({
    map: cardMap,
    clearcoat: isMobile ? 0 : 1,
    clearcoatRoughness: 0.15,
    roughness: 0.9,
    metalness: 0.8
  });
  cardMaterial.map.anisotropy = 16;

  const cardVisual = new THREE.Group();
  cardVisual.scale.setScalar(2.25);
  cardVisual.position.set(0, -1.2, -0.05);
  cardVisual.add(
    new THREE.Mesh(nodes.card.geometry, cardMaterial),
    new THREE.Mesh(nodes.clip.geometry, materials.metal),
    new THREE.Mesh(nodes.clamp.geometry, materials.metal)
  );

  const cardPivot = new THREE.Group();
  cardPivot.add(cardVisual);
  scene.add(cardPivot);

  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  curve.curveType = 'chordal';

  const bandGeometry = new MeshLineGeometry();
  const bandMaterial = new MeshLineMaterial({
    color: new THREE.Color('white'),
    depthTest: false,
    resolution: isMobile ? new THREE.Vector2(1000, 2000) : new THREE.Vector2(1000, 1000),
    useMap: 1,
    map: bandTex,
    repeat: new THREE.Vector2(-4, 1),
    lineWidth: lanyardWidth
  });
  const bandMesh = new THREE.Mesh(bandGeometry, bandMaterial);
  scene.add(bandMesh);

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const dragOffset = new THREE.Vector3();
  let dragging = false;
  let hovering = false;

  const canvas = renderer.domElement;

  const setNDCFromEvent = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const vec = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const pointerToWorld = () => {
    vec.set(pointerNDC.x, pointerNDC.y, 0.5).unproject(camera);
    dir.copy(vec).sub(camera.position).normalize();
    vec.add(dir.multiplyScalar(camera.position.length()));
    return vec;
  };

  canvas.addEventListener('pointerdown', (e) => {
    setNDCFromEvent(e);
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObject(cardVisual, true)[0];
    if (!hit) return;
    canvas.setPointerCapture(e.pointerId);
    const t = cardBody.translation();
    dragOffset.copy(hit.point).sub(new THREE.Vector3(t.x, t.y, t.z));
    dragging = true;
    cardBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointermove', (e) => {
    setNDCFromEvent(e);
    if (dragging) return;
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObject(cardVisual, true)[0];
    hovering = !!hit;
    canvas.style.cursor = hovering ? 'grab' : 'auto';
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    if (e) { try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} }
    cardBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    canvas.style.cursor = hovering ? 'grab' : 'auto';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const lerped = {
    j1: new THREE.Vector3(0.02, GROUP_Y, 0),
    j2: new THREE.Vector3(0.04, GROUP_Y, 0)
  };
  const tmp = new THREE.Vector3();

  const frameUpdate = (delta) => {
    [[j1Body, 'j1'], [j2Body, 'j2']].forEach(([body, key]) => {
      const t = body.translation();
      tmp.set(t.x, t.y, t.z);
      const clampedDistance = Math.max(0.1, Math.min(1, lerped[key].distanceTo(tmp)));
      lerped[key].lerp(tmp, delta * (MIN_SPEED + clampedDistance * (MAX_SPEED - MIN_SPEED)));
    });

    const j3t = j3Body.translation();
    const fixedT = fixedBody.translation();
    curve.points[0].set(j3t.x, j3t.y, j3t.z);
    curve.points[1].copy(lerped.j2);
    curve.points[2].copy(lerped.j1);
    curve.points[3].set(fixedT.x, fixedT.y, fixedT.z);
    bandGeometry.setPoints(curve.getPoints(isMobile ? 16 : 32));

    const angv = cardBody.angvel();
    const rot = cardBody.rotation();
    cardBody.setAngvel({ x: angv.x, y: angv.y - rot.y * 0.25, z: angv.z }, true);
  };

  const syncVisual = () => {
    const t = cardBody.translation();
    const r = cardBody.rotation();
    cardPivot.position.set(t.x, t.y, t.z);
    cardPivot.quaternion.set(r.x, r.y, r.z, r.w);
  };

  const resize = () => {
    const w = container.clientWidth, h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let lastTime = performance.now();
  const animate = (now) => {
    requestAnimationFrame(animate);
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (dragging) {
      [cardBody, j1Body, j2Body, j3Body, fixedBody].forEach((b) => b.wakeUp());
      const p = pointerToWorld();
      cardBody.setNextKinematicTranslation({ x: p.x - dragOffset.x, y: p.y - dragOffset.y, z: p.z - dragOffset.z });
    }

    world.step();
    frameUpdate(delta);
    syncVisual();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(animate);
}
