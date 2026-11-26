import { readVisualAudio, markVisualReady } from "./visual-audio.js";

// Integration for Jaume Sanchez's Codevember 2026 day 16, distributed under assets/spore/LICENSE.
// Keep the demo's simulation, lighting and pointer controls. The parent player owns audio.
const silent = () => {};
window.playerSound = { loaded: Promise.resolve(), enabled: false, running: false };
for (const event of ["update","swarm","bud","burst","pulse","fuse","part","transform","puff","unstick","stir","stretch","gather","fling","setEnabled","setPaused","setMuted","test"]) {
  window.playerSound[event] = silent;
}
await import("./assets/spore/16/bundle-MNIGGZ3P.js");
const { spores, params, camera, nextLook } = window.app;
camera.zoom = 1.45;
camera.updateProjectionMatrix();
params.auto.set(false);
const audio = parent.document.querySelector("audio");
const originalStep = spores.step;
let speed = params.speed();
let lastFrame = performance.now();
const soulLooks = [
  { palette: "coral", colonies: 1, wildness: .36, flow: .6, spin: .1, budding: 2.3, sporulation: .8 },
  { palette: "saffron", colonies: 2, wildness: .43, flow: .8, spin: .13, budding: 1.9, sporulation: 1.4, ring: .32 },
  { palette: "lichen", colonies: 1, wildness: .48, flow: .95, spin: .16, budding: 2.7, sporulation: 1.1 },
];
const defaultLook = { palette: "pollen", colonies: 1, wildness: .5, flow: .7, spin: .12, budding: 1, sporulation: 1 };
let currentLook;

spores.step = (dt, time, flowTime) => {
  const music = readVisualAudio(audio);
  const section = music.timing?.lookCues?.findLastIndex(cue => cue <= music.time) ?? -1;
  const look = section >= 0 ? soulLooks[section % soulLooks.length] : defaultLook;
  if (look !== currentLook) {
    nextLook({ look: "studio", ...look });
    currentLook = look;
  }

  const now = performance.now();
  const follow = 1 - Math.exp(-Math.min(.1, (now - lastFrame) / 1000) * 5);
  lastFrame = now;
  speed += (music.tempoScale - speed) * follow;
  params.speed.set(Math.round(speed * 100) / 100);

  originalStep(dt, time, flowTime);
  if (dt > 0) markVisualReady();
};
