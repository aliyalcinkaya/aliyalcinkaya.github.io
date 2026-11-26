const listenThreshold = 30;

async function request(path, method = "GET", data) {
  const options = method === "GET" ? {} : {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    keepalive: true,
  };
  const response = await fetch("./api/" + path, options);
  if (!response.ok) throw new Error("Music stats request failed");
  return response;
}

export function createListeningStats(audio) {
  const like = document.querySelector("#like");
  const notice = document.querySelector("#playback-status");
  const likedTracks = new Set();
  const pendingLikes = new Set();
  let likesAvailable = false;
  let selected;
  let playback;
  let anchor;

  function render() {
    like.hidden = !likesAvailable || !selected;
    if (like.hidden) return;
    like.disabled = pendingLikes.has(selected);
    const liked = likedTracks.has(selected);
    like.setAttribute("aria-pressed", String(liked));
    const label = liked ? "Unlike track" : "Like track";
    like.setAttribute("aria-label", label);
    like.title = label;
  }

  const ready = request("likes").then(response => response.json()).then(({ likedTrackIds }) => {
    if (!Array.isArray(likedTrackIds)) return false;
    for (const trackId of likedTrackIds) likedTracks.add(trackId);
    likesAvailable = true;
    render();
    return true;
  }).catch(() => false);

  async function record(event, session) {
    if (!await ready) return;
    const payload = { trackId: session.trackId, playbackId: session.id, event };
    try {
      // A replay of the same playback ID cannot inflate counts.
      await request("plays", "POST", payload).catch(() => request("plays", "POST", payload));
    } catch {
      // Playback can continue during a stats outage.
    }
  }

  function sample() {
    if (!anchor || !playback || audio.seeking) return;
    const time = audio.currentTime;
    const now = performance.now();
    const wallSeconds = (now - anchor.now) / 1000;
    const mediaSeconds = (time - anchor.time) / audio.playbackRate;
    anchor = { time, now };

    // Credit time spent playing. A forward jump or stalled clock contributes no time.
    if (mediaSeconds <= 0 || mediaSeconds > wallSeconds + .35) return;
    playback.seconds += Math.min(mediaSeconds, wallSeconds);
    if (playback.seconds >= listenThreshold && !playback.counted) {
      playback.counted = true;
      record("listen", playback);
    }
  }

  function stopSample() {
    sample();
    anchor = null;
  }

  audio.addEventListener("playing", () => {
    if (!selected || !globalThis.crypto?.randomUUID) return;
    if (!playback || playback.ended) {
      playback = { id: crypto.randomUUID(), trackId: selected, seconds: 0, counted: false, ended: false };
      record("start", playback);
    }
    anchor = { time: audio.currentTime, now: performance.now() };
  });
  audio.addEventListener("timeupdate", sample);
  audio.addEventListener("seeking", () => { anchor = null; });
  audio.addEventListener("seeked", () => {
    if (playback && !audio.paused && audio.readyState >= 3) {
      anchor = { time: audio.currentTime, now: performance.now() };
    }
  });
  for (const event of ["pause", "waiting", "ratechange"]) audio.addEventListener(event, stopSample);
  audio.addEventListener("ratechange", () => {
    if (playback && !audio.paused && !audio.seeking && audio.readyState >= 3) {
      anchor = { time: audio.currentTime, now: performance.now() };
    }
  });
  audio.addEventListener("ended", () => {
    stopSample();
    if (playback) playback.ended = true;
  });

  like.addEventListener("click", async () => {
    const trackId = selected;
    if (!likesAvailable || !trackId || pendingLikes.has(trackId)) return;
    pendingLikes.add(trackId);
    render();
    try {
      const liked = !likedTracks.has(trackId);
      await request("likes", "PUT", { trackId, liked });
      if (liked) likedTracks.add(trackId);
      else likedTracks.delete(trackId);
      if (selected === trackId) notice.textContent = "";
    } catch {
      if (selected === trackId) notice.textContent = "Could not save your like. Try again.";
    } finally {
      pendingLikes.delete(trackId);
      render();
    }
  });

  return function selectForStats(trackId) {
    selected = trackId;
    playback = anchor = null;
    render();
  };
}
