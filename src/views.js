import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.tween = null;
    // grabbing the view with the mouse cancels any camera move in progress
    controls.addEventListener('start', () => (this.tween = null));
  }

  jumpTo({ position, target }) {
    this.tween = null;
    this.camera.position.copy(position);
    this.controls.target.copy(target);
  }

  moveTo({ position, target }, duration = 1.1) {
    this.tween = {
      fromPosition: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      position,
      target,
      duration,
      t: 0,
    };
  }

  update(dt) {
    if (!this.tween) return;
    const tw = this.tween;
    tw.t = Math.min(tw.t + dt, tw.duration);
    const k = easeInOutCubic(tw.t / tw.duration);
    this.camera.position.lerpVectors(tw.fromPosition, tw.position, k);
    this.controls.target.lerpVectors(tw.fromTarget, tw.target, k);
    if (tw.t >= tw.duration) this.tween = null;
  }
}

function basis(yawDeg) {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const forward = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const side = new THREE.Vector3().crossVectors(forward, UP);
  return { forward, side };
}

// Behind and to the right of the gun, looking downrange.
export function cannonView(yawDeg) {
  const { forward, side } = basis(yawDeg);
  return {
    position: new THREE.Vector3()
      .addScaledVector(forward, -5.5)
      .addScaledVector(side, 4.5)
      .addScaledVector(UP, 2.2),
    target: new THREE.Vector3().addScaledVector(forward, 8).addScaledVector(UP, 2.5),
  };
}

// Side-on view that fits every point of the given flights.
export function overviewView(points, yawDeg, camera) {
  const { forward, side } = basis(yawDeg);
  const sphere = new THREE.Sphere().setFromPoints(points);

  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const distance = (sphere.radius / Math.sin(Math.min(vfov, hfov) / 2)) * 0.85;

  const dir = new THREE.Vector3()
    .addScaledVector(side, 0.9)
    .addScaledVector(forward, -0.35)
    .addScaledVector(UP, 0.15)
    .normalize();

  const position = sphere.center.clone().addScaledVector(dir, distance);
  position.y = Math.max(position.y, 2);
  return { position, target: sphere.center.clone() };
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}
