import { tracks } from "./tracks.js";

const audio = document.querySelector("audio");
const stage = document.querySelector("#stage");
const cover = document.querySelector(".track img");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const spore = {
  title: "Spore",
  path: "16/?quality=low&seed=spore&palette=pollen&auto=false",
};
const sketches = new Map([
  ["assets/music/maze-vocoder.mp3", {
    title: "Tesseract",
    path: "8/?quality=low&seed=maze&auto=false&animation=chase&pattern=gradient&lights=ocean",
  }],
  ["assets/music/music-to-soul.mp3", spore],
  ["assets/music/music-to.mp3", {
    title: "Feather",
    path: "12/?quality=low&seed=feather&auto=false&look=dark&palette=snowy&feathers=4500",
  }],
]);
let activeSketch;

function showArtwork() {
  const source = audio.getAttribute("src");
  const sketch = sketches.get(source) ?? spore;
  const poster = tracks.find(track => track.src === source)?.poster ?? "assets/spore/poster.jpg";
  const changed = sketch !== activeSketch;
  if (changed) {
    activeSketch = sketch;
    cover.src = poster;
    stage.style.setProperty("--visual-poster", `url("${poster}")`);
  }
  if (reducedMotion.matches) {
    stage.replaceChildren();
    return;
  }
  const currentFrame = stage.firstElementChild;
  if (changed || !currentFrame) {
    const frame = currentFrame ?? document.createElement("iframe");
    frame.classList.remove("ready");
    frame.title = `${sketch.title}, a Three.js animation by Jaume Sanchez Elias`;
    const url = new URL("assets/spore/" + sketch.path, document.baseURI);
    const maxPixelRatio = Math.min(1, 1600 / stage.clientWidth, 1100 / stage.clientHeight);
    url.searchParams.set("dpr", maxPixelRatio.toFixed(3));
    frame.src = url.href;
    if (!currentFrame) stage.append(frame);
  }
}

audio.addEventListener("trackchange", showArtwork);
reducedMotion.addEventListener("change", showArtwork);
showArtwork();
