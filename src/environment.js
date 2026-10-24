import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Max range is about 1020 m (100 m/s at 45°), so the paved range covers every possible landing.
const PAVED_RADIUS = 1150;
const TILE_SIZE = 5;
const RING_STEP = 50;
const RING_MAX = 1100;
const SUN_ELEVATION = 40;
const SUN_AZIMUTH = -35;

export const HORIZON_COLOR = 0xbfd5e6;

export function createEnvironment({ scene, renderer, sun }) {
  const rand = mulberry32(1815);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - SUN_ELEVATION),
    THREE.MathUtils.degToRad(SUN_AZIMUTH),
  );
  sun.position.copy(sunDir).multiplyScalar(40);

  addSky(scene, renderer, sunDir);
  addGround(scene, maxAniso);
  addMountains(scene, rand);
  addTrees(scene, rand);
  addClouds(scene, rand);
  const markers = addRangeMarkers(scene);

  return {
    setRange(deg, range) {
      markers.setDirection(deg, range);
    },
    setLabelsVisible(visible) {
      markers.setLabelsVisible(visible);
    },
  };
}

function addSky(scene, renderer, sunDir) {
  const sky = new Sky();
  sky.scale.setScalar(15000);
  const u = sky.material.uniforms;
  u.turbidity.value = 3.5;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(sunDir);

  // light the scene from the sky itself so metal reflects something believable
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(sky);
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.environmentIntensity = 0.25;
  pmrem.dispose();

  scene.add(sky);
  scene.fog = new THREE.Fog(HORIZON_COLOR, 2500, 11000);
}

function addGround(scene, maxAniso) {
  const tiles = new THREE.CanvasTexture(makeTileCanvas());
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.anisotropy = maxAniso;
  // one canvas holds 4 x 4 tiles
  tiles.repeat.setScalar((PAVED_RADIUS * 2) / (TILE_SIZE * 4));

  const pavement = new THREE.Mesh(
    new THREE.CircleGeometry(PAVED_RADIUS, 256),
    new THREE.MeshStandardMaterial({
      map: tiles,
      roughness: 0.8,
      // pushed back so the range rings drawn just above never z-fight with it
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    }),
  );
  pavement.rotation.x = -Math.PI / 2;
  pavement.receiveShadow = true;
  scene.add(pavement);

  const grassTex = new THREE.CanvasTexture(makeGrassCanvas());
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.anisotropy = maxAniso;
  // RingGeometry UVs span the outer diameter
  grassTex.repeat.setScalar(24000 / 40);

  // a ring rather than a plane underneath, so the two surfaces never overlap
  const grass = new THREE.Mesh(
    new THREE.RingGeometry(PAVED_RADIUS - 1, 12000, 256, 1),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  scene.add(grass);
}

function addMountains(scene, rand) {
  const ranges = [
    { radius: 9000, base: 500, amp: 1100, low: 0x8fa3bd, high: 0xc3d0de, segments: 512 },
    { radius: 6500, base: 250, amp: 650, low: 0x5c7088, high: 0x95a8bd, segments: 512 },
    { radius: 3200, base: 40, amp: 160, low: 0x3d5640, high: 0x5f7a5c, segments: 384 },
  ];
  for (const r of ranges) scene.add(mountainRing(r, ridgeNoise(rand)));
}

function mountainRing({ radius, base, amp, low, high, segments }, noise) {
  const positions = [];
  const colors = [];
  const indices = [];
  const lowColor = new THREE.Color(low);
  const highColor = new THREE.Color(high);
  const c = new THREE.Color();

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    const h = base + amp * noise(t) ** 1.6;
    positions.push(x, -30, z, x, h * 0.45, z, x, h, z);
    for (const k of [0, 0.4, 1]) {
      c.copy(lowColor).lerp(highColor, k);
      colors.push(c.r, c.g, c.b);
    }
    if (i < segments) {
      const a = i * 3;
      const b = a + 3;
      indices.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
}

function addTrees(scene, rand) {
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 4, 6).translate(0, 2, 0);
  const roundGeo = new THREE.IcosahedronGeometry(3.6, 1).translate(0, 6.5, 0);
  const pointGeo = new THREE.ConeGeometry(3, 10, 7).translate(0, 8, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });

  const count = 2600;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const round = new THREE.InstancedMesh(roundGeo, leafMat, count);
  const pointed = new THREE.InstancedMesh(pointGeo, leafMat, count);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const green = new THREE.Color();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  // trees clump into groves rather than spreading evenly
  const groves = Array.from({ length: 70 }, () => ({
    angle: rand() * Math.PI * 2,
    dist: PAVED_RADIUS + 60 + rand() * 900,
    spread: 40 + rand() * 120,
  }));

  for (let i = 0; i < count; i++) {
    const g = groves[Math.floor(rand() * groves.length)];
    const a = g.angle + ((rand() - 0.5) * g.spread) / g.dist;
    const d = Math.max(PAVED_RADIUS + 40, g.dist + (rand() - 0.5) * g.spread);
    p.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI * 2);
    s.setScalar(1.4 + rand() * 1.1);
    m.compose(p, q, s);

    trunks.setMatrixAt(i, m);
    const isRound = rand() < 0.65;
    round.setMatrixAt(i, isRound ? m : hidden);
    pointed.setMatrixAt(i, isRound ? hidden : m);
    green.setHSL(0.25 + rand() * 0.07, 0.45 + rand() * 0.2, 0.07 + rand() * 0.06);
    round.setColorAt(i, green);
    pointed.setColorAt(i, green);
  }
  scene.add(trunks, round, pointed);
}

function addClouds(scene, rand) {
  const texture = new THREE.CanvasTexture(makeCloudCanvas(rand));
  texture.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.55 + rand() * 0.35, fog: false, depthWrite: false }),
    );
    const a = rand() * Math.PI * 2;
    const d = 3500 + rand() * 4500;
    cloud.position.set(Math.cos(a) * d, 900 + rand() * 1200, Math.sin(a) * d);
    const w = 900 + rand() * 1400;
    cloud.scale.set(w, w * (0.28 + rand() * 0.1), 1);
    scene.add(cloud);
  }
}

function addRangeMarkers(scene) {
  const group = new THREE.Group();
  const minor = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  const major = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });

  // arcs cover the whole -90°..90° traverse plus a margin
  const span = THREE.MathUtils.degToRad(100);
  for (let d = RING_STEP; d <= RING_MAX; d += RING_STEP) {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = -span + (i / 160) * span * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * d, 0.02, -Math.sin(a) * d));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), d % 100 ? minor : major));
  }

  const labels = [];
  for (let d = 50; d <= 1000; d += d < 200 ? 50 : 100) {
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeLabelTexture(`${d} m`),
        transparent: true,
        fog: false,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    );
    label.scale.set(0.07, 0.07 * 0.375, 1);
    label.center.set(0.5, 0);
    label.userData.distance = d;
    labels.push(label);
    group.add(label);
  }
  scene.add(group);

  let labelsWanted = false;
  let reach = 0;
  const refresh = () => {
    for (const label of labels) {
      label.visible = labelsWanted && label.userData.distance <= Math.max(100, reach * 1.25);
    }
  };

  return {
    setDirection(deg, range) {
      // a few degrees toward the camera side so the label doesn't sit on the landing spot
      const a = THREE.MathUtils.degToRad(deg - 4);
      for (const label of labels) {
        const d = label.userData.distance;
        label.position.set(Math.cos(a) * d, 0.5, -Math.sin(a) * d);
      }
      reach = range;
      refresh();
    },
    setLabelsVisible(visible) {
      labelsWanted = visible;
      refresh();
    },
  };
}

function makeTileCanvas() {
  const size = 1024;
  const n = 4;
  const cell = size / n;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(42);

  ctx.fillStyle = '#4e514d';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const l = 40 + rand() * 7;
      ctx.fillStyle = `hsl(90, 4%, ${l}%)`;
      ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
    }
  }
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rand() - 0.5) * 14;
    img.data[i] += v;
    img.data[i + 1] += v;
    img.data[i + 2] += v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function makeGrassCanvas() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(7);
  ctx.fillStyle = '#5b7040';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `hsl(${70 + rand() * 30}, ${25 + rand() * 20}%, ${22 + rand() * 18}%)`;
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2 + rand() * 3);
  }
  return canvas;
}

function makeCloudCanvas(rand) {
  const w = 512;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const x = w * (0.15 + rand() * 0.7);
    const y = h * (0.45 + (rand() - 0.5) * 0.35);
    const r = 30 + rand() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return canvas;
}

function makeLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(20, 28, 40, 0.75)';
  ctx.strokeText(text, 128, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Sum of ridged sines; whole-number frequencies so the ring closes without a seam.
function ridgeNoise(rand) {
  const octaves = Array.from({ length: 6 }, (_, k) => ({
    f: Math.round((4 + rand() * 4) * 2 ** k),
    phase: rand() * Math.PI,
    amp: 0.55 ** k,
  }));
  const total = octaves.reduce((sum, o) => sum + o.amp, 0);
  return (t) => {
    let v = 0;
    for (const o of octaves) v += o.amp * (1 - Math.abs(Math.sin(o.f * t * 0.5 + o.phase)));
    return v / total;
  };
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
