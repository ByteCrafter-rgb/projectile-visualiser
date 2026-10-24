import { Vector3 } from 'three';

export const GRAVITY = 9.81;
export const BALL_RADIUS = 0.06;

export function positionAt(origin, velocity, t, target = new Vector3()) {
  return target.set(
    origin.x + velocity.x * t,
    origin.y + velocity.y * t - 0.5 * GRAVITY * t * t,
    origin.z + velocity.z * t,
  );
}

// No drag, so this is closed-form. The ball lands when its centre is one radius above the ground.
export function solveFlight(origin, velocity) {
  const drop = origin.y - BALL_RADIUS;
  const time = (velocity.y + Math.sqrt(velocity.y ** 2 + 2 * GRAVITY * drop)) / GRAVITY;
  const apexTime = Math.max(0, velocity.y / GRAVITY);
  const apex = positionAt(origin, velocity, apexTime).y;
  const landing = positionAt(origin, velocity, time);
  const range = Math.hypot(landing.x - origin.x, landing.z - origin.z);
  return { time, apex, landing, range };
}
