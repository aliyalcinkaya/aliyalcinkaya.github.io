import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import sirv from "sirv";
import { tracks } from "./tracks.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const databasePath = resolve(process.env.MUSIC_DB ?? resolve(root, ".data/music.sqlite"));

if (process.argv[2] === "--stats") {
  if (!existsSync(databasePath)) {
    console.error("Start the music server once to initialize the database.");
    process.exit(1);
  }
  const reader = new DatabaseSync(databasePath, { readOnly: true });
  const totals = reader.prepare(`
    SELECT
      (SELECT count(*) FROM plays WHERE track_id = ?1) AS starts,
      (SELECT count(listened_at) FROM plays WHERE track_id = ?1) AS listens,
      (SELECT count(*) FROM likes WHERE track_id = ?1) AS likes
  `);
  console.table(tracks.map(track => ({ track: track.title, ...totals.get(track.id) })));
  reader.close();
  process.exit(0);
}

mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS plays (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    listened_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS plays_track ON plays (track_id);

  CREATE TABLE IF NOT EXISTS likes (
    track_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    liked_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (track_id, visitor_id)
  );
  CREATE INDEX IF NOT EXISTS likes_visitor ON likes (visitor_id);
`);

const ownLikes = db.prepare("SELECT track_id FROM likes WHERE visitor_id = ?");
const addPlay = db.prepare(`
  INSERT INTO plays (id, track_id, listened_at) VALUES (?, ?, CASE WHEN ? THEN unixepoch() END)
  ON CONFLICT(id) DO UPDATE
    SET listened_at = coalesce(plays.listened_at, excluded.listened_at)
    WHERE plays.track_id = excluded.track_id
`);
const addLike = db.prepare("INSERT OR IGNORE INTO likes (track_id, visitor_id) VALUES (?, ?)");
const removeLike = db.prepare("DELETE FROM likes WHERE track_id = ? AND visitor_id = ?");
const trackIds = new Set(tracks.map(track => track.id));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "private, no-store" });
  res.end(JSON.stringify(data));
}

const publicOrigin = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).origin : null;

function visitorId(req, res) {
  const stored = req.headers.cookie?.match(/(?:^|;\s*)music_visitor=([^;]+)/)?.[1];
  if (uuid.test(stored ?? "")) return stored;
  const visitor = randomUUID();
  const secure = publicOrigin?.startsWith("https:") ? "; Secure" : "";
  res.setHeader("Set-Cookie", `music_visitor=${visitor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`);
  return visitor;
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > 2048) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks));
  } catch {
    return null;
  }
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/likes" && req.method === "GET") {
    const visitor = visitorId(req, res);
    return sendJson(res, 200, { likedTrackIds: ownLikes.all(visitor).map(row => row.track_id) });
  }
  const play = pathname === "/api/plays" && req.method === "POST";
  const like = pathname === "/api/likes" && req.method === "PUT";
  if (!play && !like) return sendJson(res, 404, { error: "Unknown endpoint" });
  const origin = publicOrigin ?? `http://${req.headers.host}`;
  if (req.headers.origin && req.headers.origin !== origin) return sendJson(res, 403, { error: "Origin denied" });
  if (req.headers["content-type"]?.split(";")[0] !== "application/json") {
    return sendJson(res, 415, { error: "Use application/json" });
  }
  const body = await readBody(req);
  if (!trackIds.has(body?.trackId)) return sendJson(res, 400, { error: "Unknown track" });
  if (play) {
    if (typeof body.playbackId !== "string" || !uuid.test(body.playbackId) || !["start", "listen"].includes(body.event)) {
      return sendJson(res, 400, { error: "Invalid play event" });
    }
    addPlay.run(body.playbackId, body.trackId, Number(body.event === "listen"));
  } else {
    if (typeof body.liked !== "boolean") return sendJson(res, 400, { error: "Invalid like" });
    (body.liked ? addLike : removeLike).run(body.trackId, visitorId(req, res));
  }
  res.writeHead(204, { "Cache-Control": "no-store" });
  res.end();
}

const files = new Set([
  "/", "/index.html", "/about.html", "/site.css", "/player.js", "/tracks.js",
  "/listening-stats.js", "/scene.js", "/track-timing.js", "/visual-audio.js",
  "/visual-stage.js", "/codevember-scene.js",
]);
const staticFiles = sirv(root, { dev: true, dotfiles: false });
const notFound = res => sendJson(res, 404, { error: "Not found" });
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname.includes("\\") || pathname.split("/").some(part => part.startsWith("."))) return notFound(res);
    if (pathname.startsWith("/api/")) return await handleApi(req, res, pathname);
    if (["GET", "HEAD"].includes(req.method) && (files.has(pathname) || pathname.startsWith("/assets/"))) {
      return staticFiles(req, res, () => notFound(res));
    }
    notFound(res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { error: "Server error" });
    else res.end();
  }
});
const port = Number(process.env.PORT ?? 8274);
const host = process.env.HOST ?? "127.0.0.1";
server.listen(port, host, () => console.log(`Music site listening on http://${host}:${port}`));
