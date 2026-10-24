import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { BALL_RADIUS, positionAt, solveFlight } from './physics.js';

const PATH_SAMPLES = 120;
const MARKER_COUNT = 14;

const ballGeometry = new THREE.SphereGeometry(1, 24, 12);
const markerTexture = makeDotTexture();

export class Shot {
  constructor(scene, origin, velocity, color) {
    this.scene = scene;
    this.origin = origin.clone();
    this.velocity = velocity.clone();
    this.flight = solveFlight(origin, velocity);
    this.t = 0;

    const { time } = this.flight;
    const p = new THREE.Vector3();

    const pathPositions = [];
    for (let i = 0; i <= PATH_SAMPLES; i++) {
      positionAt(origin, velocity, (i / PATH_SAMPLES) * time, p);
      pathPositions.push(p.x, p.y, p.z);
    }
    const pathGeometry = new LineGeometry();
    pathGeometry.setPositions(pathPositions);
    pathGeometry.instanceCount = 0;
    this.path = new Line2(
      pathGeometry,
      new LineMaterial({ color, linewidth: 3, dashed: true, dashSize: 1.6, gapSize: 1.1 }),
    );
    this.path.computeLineDistances();

    this.markerTimes = [];
    const markerPositions = [];
    for (let i = 1; i < MARKER_COUNT; i++) {
      const mt = (i / MARKER_COUNT) * time;
      positionAt(origin, velocity, mt, p);
      this.markerTimes.push(mt);
      markerPositions.push(p.x, p.y, p.z);
    }
    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(markerPositions, 3));
    markerGeometry.setDrawRange(0, 0);
    this.markers = new THREE.Points(
      markerGeometry,
      new THREE.PointsMaterial({
        color,
        map: markerTexture,
        size: 11,
        sizeAttenuation: false,
        alphaTest: 0.5,
      }),
    );

    const ballColor = new THREE.Color(color);
    this.ball = new THREE.Mesh(
      ballGeometry,
      new THREE.MeshStandardMaterial({
        color: ballColor,
        emissive: ballColor,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.2,
      }),
    );
    this.ball.castShadow = true;

    scene.add(this.path, this.markers, this.ball);
  }

  get landed() {
    return this.t >= this.flight.time;
  }

  update(dt, camera) {
    this.t = Math.min(this.t + dt, this.flight.time);
    const progress = this.t / this.flight.time;

    this.path.geometry.instanceCount = Math.floor(progress * PATH_SAMPLES);
    const shown = this.markerTimes.filter((mt) => mt <= this.t).length;
    this.markers.geometry.setDrawRange(0, shown);

    positionAt(this.origin, this.velocity, this.t, this.ball.position);

    // A real 12 cm ball vanishes at 100 m, so draw it bigger the further it is from the camera.
    const radius = THREE.MathUtils.clamp(
      camera.position.distanceTo(this.ball.position) * 0.008,
      BALL_RADIUS,
      4,
    );
    this.ball.scale.setScalar(radius);
    this.ball.position.y = Math.max(this.ball.position.y, radius);
  }

  dispose() {
    this.scene.remove(this.path, this.markers, this.ball);
    this.path.geometry.dispose();
    this.path.material.dispose();
    this.markers.geometry.dispose();
    this.markers.material.dispose();
    this.ball.material.dispose();
  }
}

function makeDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
