import { trackTiming } from "./track-timing.js";

export function markVisualReady() {
  const frame = frameElement;
  // The previous sketch can draw one more frame while its replacement is loading.
  if (frame && !frame.classList.contains("ready") && new URL(frame.src).pathname === location.pathname) {
    frame.classList.add("ready");
  }
}

export function readVisualAudio(audio) {
  const timing = trackTiming.get(audio?.getAttribute("src"));
  const playing = audio && !audio.paused && !audio.ended;
  return {
    time: audio?.currentTime ?? 0,
    timing,
    tempoScale: playing && timing ? timing.bpm / 112 : 1,
  };
}
