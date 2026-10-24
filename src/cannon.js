import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Barrel space: origin on the trunnions, bore along +X, muzzle face at x = 1.1 m.
const MUZZLE = new THREE.Vector3(1.1, 0, 0);
const BORE = new THREE.Vector3(1, 0, 0);
const RECOIL_DISTANCE = 0.3;

export async function loadCannon(scene) {
  const gltf = await new GLTFLoader().loadAsync('/models/cannon.glb');
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  scene.add(gltf.scene);
  return new Cannon(gltf.scene);
}

class Cannon {
  constructor(root) {
    this.root = root;
    this.barrel = root.getObjectByName('Barrel');
    this.flashLevel = 0;
    this.recoil = 0;

    this.flashLight = new THREE.PointLight(0xffa040, 0, 12, 2);
    this.flashBall = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        color: 0xffb060,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.flashLight.position.set(1.3, 0, 0);
    this.flashBall.position.set(1.3, 0, 0);
    this.barrel.add(this.flashLight, this.flashBall);
  }

  setElevation(deg) {
    this.barrel.rotation.z = THREE.MathUtils.degToRad(deg);
  }

  setDirection(deg) {
    this.root.rotation.y = THREE.MathUtils.degToRad(deg);
  }

  muzzle() {
    this.root.updateMatrixWorld(true);
    return {
      origin: this.barrel.localToWorld(MUZZLE.clone()),
      direction: BORE.clone().transformDirection(this.barrel.matrixWorld),
    };
  }

  // Muzzle for a hypothetical elevation, without moving the barrel.
  muzzleAt(deg) {
    const current = this.barrel.rotation.z;
    this.setElevation(deg);
    const result = this.muzzle();
    this.barrel.rotation.z = current;
    this.root.updateMatrixWorld(true);
    return result;
  }

  fire() {
    this.flashLevel = 1;
    this.recoil = 1;
  }

  update(dt) {
    this.flashLevel = Math.max(0, this.flashLevel - dt * 3);
    this.flashLight.intensity = 80 * this.flashLevel;
    this.flashBall.material.opacity = this.flashLevel;
    this.flashBall.scale.setScalar(0.8 + (1 - this.flashLevel) * 1.6);

    this.recoil = Math.max(0, this.recoil - dt * 1.5);
    const kick = RECOIL_DISTANCE * this.recoil ** 2;
    const yaw = this.root.rotation.y;
    this.root.position.set(-Math.cos(yaw) * kick, 0, Math.sin(yaw) * kick);
  }
}

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,220,150,0.8)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
