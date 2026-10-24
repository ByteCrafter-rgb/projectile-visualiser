# Projectile Visualiser

An interactive 3D cannon range built with Three.js. Set the launch speed, elevation and direction, fire, and watch the shot follow a true ballistic arc (gravity only, no drag) across a real-scale range.

## Features

- Real-scale Napoleonic field gun, modelled in Blender and loaded as glTF
- Launch speed, angle and traverse controls with live range, apex and flight-time predictions
- "Show multiple angles" fires a 75° / 60° / 45° / 30° volley to compare trajectories
- Dashed flight paths with timing markers, muzzle flash and recoil
- Cannon and overview cameras; the overview auto-frames the predicted flight
- Sky, procedural mountains, tree line and range rings every 50 m

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Space fires; drag to orbit, scroll to zoom.

## Project layout

```
src/
  main.js         scene setup and render loop
  physics.js      closed-form projectile motion
  cannon.js       model loading, aiming, flash and recoil
  shot.js         a single projectile and its trail
  views.js        camera views and transitions
  environment.js  sky, terrain, trees and range markers
  ui.js           control panel
public/models/    cannon.glb (exported)
assets/           cannon.blend (source)
```

The barrel's origin sits on the trunnions, so `Barrel.rotation.z` is the elevation.
