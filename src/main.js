import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadCannon } from './cannon.js';
import { createEnvironment } from './environment.js';
import { positionAt, solveFlight } from './physics.js';
import { Shot } from './shot.js';
import { createUI } from './ui.js';
import { CameraRig, cannonView, overviewView } from './views.js';

const SINGLE_COLOR = '#ffd60a';
const VOLLEY = [
  { angle: 75, color: '#ff453a', note: 'Short range, high arc' },
  { angle: 60, color: '#ff9f0a', note: 'Medium range' },
  { angle: 45, color: '#0a84ff', note: 'Near maximum range' },
  { angle: 30, color: '#30d158', note: 'Longer range, lower arc' },
];
const VOLLEY_GAP = 0.45;
const RESTORE_DELAY = 0.6;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.3, 30000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
const rig = new CameraRig(camera, controls);

const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
scene.add(sun);

const environment = createEnvironment({ scene, renderer, sun });

const cannon = await loadCannon(scene);

let shots = [];
let queue = [];
let volleyClock = 0;
let restoreAt = Infinity;
let lastAim = null;

const ui = createUI({ onChange: aim, onFire: fire, onView: (state) => showView(state, 1.1) });
aim(ui.state);
rig.jumpTo(cannonView(ui.state.direction));

function launchVelocity(direction, speed) {
  return direction.clone().multiplyScalar(speed);
}

function flightFor(angle, speed) {
  const { origin, direction } = cannon.muzzleAt(angle);
  const velocity = launchVelocity(direction, speed);
  return { origin, velocity, ...solveFlight(origin, velocity) };
}

function salvoFor(state) {
  return state.multi ? VOLLEY : [{ angle: state.angle, color: SINGLE_COLOR }];
}

function showView(state, duration) {
  // from behind the gun every label lines up on one sightline, so only show them side-on
  environment.setLabelsVisible(state.view === 'overview');
  if (state.view === 'cannon') {
    rig.moveTo(cannonView(state.direction), duration);
    return;
  }
  const points = [new THREE.Vector3(0, 0, 0)];
  for (const { angle } of salvoFor(state)) {
    const f = flightFor(angle, state.speed);
    for (let i = 0; i <= 16; i++) points.push(positionAt(f.origin, f.velocity, (i / 16) * f.time));
  }
  rig.moveTo(overviewView(points, state.direction, camera), duration);
}

function aim(state) {
  // old paths stop lining up with the muzzle once the gun turns or the charge changes
  if (lastAim && (lastAim.speed !== state.speed || lastAim.direction !== state.direction)) {
    clearShots();
  }
  lastAim = { speed: state.speed, direction: state.direction };

  cannon.setDirection(state.direction);
  cannon.setElevation(state.angle);

  const single = flightFor(state.angle, state.speed);
  const volley = VOLLEY.map((v) => ({ ...v, range: flightFor(v.angle, state.speed).range }));
  ui.setStats(single);
  ui.setLegend(volley);

  const reach = state.multi ? Math.max(...volley.map((v) => v.range)) : single.range;
  environment.setRange(state.direction, reach);
  showView(state, 0.5);
}

function clearShots() {
  for (const shot of shots) shot.dispose();
  shots = [];
  queue = [];
}

function fire(state) {
  clearShots();
  const salvo = salvoFor(state);
  queue = salvo.map((s, i) => ({ ...s, at: i * VOLLEY_GAP }));
  volleyClock = 0;
  restoreAt = (salvo.length - 1) * VOLLEY_GAP + RESTORE_DELAY;
  if (state.view !== 'overview') ui.setView('overview');
}

function updateVolley(dt) {
  volleyClock += dt;
  while (queue.length && queue[0].at <= volleyClock) {
    const next = queue.shift();
    cannon.setElevation(next.angle);
    const { origin, direction } = cannon.muzzle();
    shots.push(new Shot(scene, origin, launchVelocity(direction, ui.state.speed), next.color));
    cannon.fire();
  }
  if (volleyClock >= restoreAt) {
    cannon.setElevation(ui.state.angle);
    restoreAt = Infinity;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  updateVolley(dt);
  cannon.update(dt);
  for (const shot of shots) shot.update(dt, camera);
  rig.update(dt);
  controls.update();
  renderer.render(scene, camera);
});
