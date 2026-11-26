import { tracks as publishedTracks } from "./tracks.js";
import { createListeningStats } from "./listening-stats.js";

const audio = document.querySelector("audio");
const fileInput = document.querySelector("#file");
const title = document.querySelector("#title");
const expand = document.querySelector("#expand");
const status = document.querySelector("#playback-status");
const queue = document.querySelector("#queue");
const previous = document.querySelector("#prev");
const next = document.querySelector("#next");
const play = document.querySelector("#play");
const seek = document.querySelector("#seek");
const elapsed = document.querySelector("#elapsed");
const duration = document.querySelector("#duration");
const tracks = [...publishedTracks];
const playlist = document.querySelector(".playlist");
const playlistToggle = playlist.querySelector("summary");
const selectForStats = createListeningStats(audio);
let localUrl;
let current = 0;

function formatTime(seconds) {
  const total = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function updateTimeline() {
  const length = Number.isFinite(audio.duration) ? audio.duration : 0;
  seek.disabled = length === 0;
  seek.max = length;
  seek.value = audio.currentTime;
  elapsed.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(length);
  seek.setAttribute("aria-valuetext", elapsed.textContent + " of " + duration.textContent);
}

function setSongStatus(meta, text) {
  if (meta.textContent !== text) meta.textContent = text;
  meta.hidden = !text;
}

function updatePlayer() {
  const playing = !audio.paused && !audio.ended;
  play.classList.toggle("playing", playing);
  play.setAttribute("aria-label", playing ? "Pause" : "Play");
  previous.disabled = current === 0;
  next.disabled = current === tracks.length - 1;
  const selected = queue.children[current]?.querySelector(".song-meta");
  if (selected) setSongStatus(selected, playing ? "Now playing" : "Selected");
  updateTimeline();
}

async function start() {
  status.textContent = "";
  try {
    await audio.play();
  } catch (error) {
    if (error.name !== "AbortError") {
      status.textContent = "This media could not play. Try again or choose another track.";
    }
  }
}

function renderSong(track, index) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.className = "song-row";
  const cover = document.createElement("img");
  cover.src = track.poster ?? "assets/spore/poster.jpg";
  cover.alt = "";
  const labels = document.createElement("span");
  const name = document.createElement("span");
  name.className = "song-title";
  name.textContent = track.title;
  const meta = document.createElement("span");
  meta.className = "song-meta";
  setSongStatus(meta, track.file ? "Local file" : "");
  labels.append(name, meta);
  button.append(cover, labels);
  button.addEventListener("click", () => selectTrack(index, true));
  item.append(button);
  queue.append(item);
}

function selectTrack(index, shouldPlay) {
  const track = tracks[index];
  if (!track) return;
  if (index === current && audio.getAttribute("src")) {
    if (shouldPlay && audio.paused) start();
    return;
  }
  const previousRow = queue.children[current]?.firstElementChild;
  if (previousRow) {
    previousRow.removeAttribute("aria-current");
    setSongStatus(previousRow.querySelector(".song-meta"), tracks[current].file ? "Local file" : "");
  }
  current = index;
  const selectedRow = queue.children[index].firstElementChild;
  selectedRow.setAttribute("aria-current", "true");
  const oldUrl = localUrl;
  localUrl = track.file ? URL.createObjectURL(track.file) : undefined;
  selectForStats(track.id);
  audio.src = localUrl || track.src;
  audio.dispatchEvent(new Event("trackchange"));
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  title.textContent = track.title;
  status.textContent = "";
  updatePlayer();
  if (shouldPlay) start();
}

function closePlaylist() {
  playlist.open = false;
  playlistToggle.focus();
}

document.querySelector("#close-playlist").addEventListener("click", closePlaylist);
playlist.addEventListener("keydown", event => {
  if (event.key === "Escape" && playlist.open) closePlaylist();
});

const dock = document.querySelector(".player");
new ResizeObserver(() => {
  dock.style.setProperty("--dock-height", dock.offsetHeight + "px");
}).observe(dock);

tracks.forEach(renderSong);
fileInput.addEventListener("change", () => {
  for (const file of fileInput.files) {
    const track = { file, title: file.name.replace(/\.[^.]+$/, "") };
    tracks.push(track);
    renderSong(track, tracks.length - 1);
  }
  fileInput.value = "";
  updatePlayer();
});

previous.addEventListener("click", () => selectTrack(current - 1, !audio.paused));
next.addEventListener("click", () => selectTrack(current + 1, !audio.paused));
audio.addEventListener("ended", () => selectTrack(current + 1, true));
play.addEventListener("click", () => {
  if (audio.paused || audio.ended) start();
  else audio.pause();
});
seek.addEventListener("input", () => {
  audio.currentTime = Number(seek.value);
  updateTimeline();
});

for (const event of ["loadedmetadata", "emptied", "durationchange", "play", "pause", "ended", "timeupdate"]) {
  audio.addEventListener(event, updatePlayer);
}
audio.addEventListener("error", () => {
  status.textContent = "This track could not load. Choose another song or try again.";
});

expand.hidden = !document.fullscreenEnabled;
expand.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    status.textContent = "Browser fullscreen is unavailable.";
  }
});
document.addEventListener("fullscreenchange", () => {
  const fullscreen = Boolean(document.fullscreenElement);
  const label = fullscreen ? "Exit fullscreen" : "Fullscreen";
  expand.setAttribute("aria-label", label);
  expand.title = label;
  expand.setAttribute("aria-pressed", String(fullscreen));
});

selectTrack(0, false);
