#!/usr/bin/env node
/**
 * Tiny Daybook sync API: GET/PUT /books/:id
 * Writes durable snapshots to the daybook-data branch (not main/Pages).
 */
import http from "node:http";
import { spawnSync } from "node:child_process";

const PORT = Number(process.env.PORT || 8787);
const OWNER = "ansrkian-gif";
const REPO = "my-chit";
const BRANCH = "daybook-data";
const REPO_API = `https://api.github.com/repos/${OWNER}/${REPO}`;

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const out = spawnSync(
    "git",
    ["config", "--global", "--get-regexp", "url\\..*github\\.com"],
    { encoding: "utf8" }
  );
  const line = (out.stdout || "").split("\n")[0] || "";
  const match = line.match(/x-access-token:([^@]+)@/);
  return match ? match[1] : "";
}

function send(res, status, body, type = "application/json") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Bypass-Tunnel-Reminder",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function gh(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${REPO_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "daybook-sync",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, json };
}

async function putBook(bookId, payload, token) {
  const path = `daybook/cloud/${bookId}.json`;
  const content = Buffer.from(JSON.stringify(payload, null, 2) + "\n").toString("base64");
  let sha;
  const existing = await gh(`/contents/${path}?ref=${BRANCH}`, { token });
  if (existing.ok) sha = existing.json.sha;
  const write = await gh(`/contents/${path}`, {
    method: "PUT",
    token,
    body: {
      message: `chore(daybook): sync ${bookId}`,
      content,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    },
  });
  return write;
}

async function getBook(bookId) {
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/daybook/cloud/${bookId}.json?ts=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return { ok: false, status: response.status, json: null };
  return { ok: true, status: 200, json: await response.json() };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/books\/([A-Za-z0-9_-]{6,64})$/);
  if (!match) {
    send(res, 200, { ok: true, service: "daybook-sync" });
    return;
  }
  const bookId = match[1];
  try {
    if (req.method === "GET") {
      const book = await getBook(bookId);
      if (!book.ok) {
        send(res, book.status || 404, { error: "not_found" });
        return;
      }
      send(res, 200, book.json);
      return;
    }
    if (req.method === "PUT") {
      const token = githubToken();
      if (!token) {
        send(res, 500, { error: "missing_github_token" });
        return;
      }
      const raw = await readBody(req);
      const payload = JSON.parse(raw.toString("utf8") || "{}");
      payload.bookId = bookId;
      const write = await putBook(bookId, payload, token);
      if (!write.ok) {
        send(res, write.status || 500, { error: "write_failed", detail: write.json });
        return;
      }
      send(res, 200, { ok: true, bookId });
      return;
    }
    send(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    send(res, 500, { error: String(error?.message || error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`daybook-sync on http://127.0.0.1:${PORT}`);
});
