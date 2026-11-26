// The upstream sketches run in their own frames. Only the parent player produces audio.
import { readVisualAudio, markVisualReady } from "./visual-audio.js";

const isFeather = document.documentElement.dataset.sketch === "feather";
if (isFeather) {
  const silent = () => {};
  window.playerSound = { enabled: false, running: false, setEnabled: silent, update: silent, chirp: silent };
  await import("./assets/spore/12/bundle-BNPEQRVK.js");
} else {
  await import("./assets/spore/8/bundle-SR2XSFXK.js");
}

const app = window.app;
const audio = parent.document.querySelector("audio");
const draw = app.pipeline.render.bind(app.pipeline);

app.pipeline.render = (...args) => {
  const { tempoScale } = readVisualAudio(audio);
  if (isFeather) {
    app.timeScale = tempoScale;
  } else {
    app.params.speed.set(tempoScale * 1.4);
    app.params.spin.set(tempoScale * .3);
  }
  const result = draw(...args);
  markVisualReady();
  return result;
};
