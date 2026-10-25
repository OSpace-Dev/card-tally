import express from "express";
import { build } from "vite";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
const dir = mkdtempSync(path.join(tmpdir(), "card-tally-releases-"));
const a = path.join(dir, "a"),
  b = path.join(dir, "b"),
  c = path.join(dir, "c");
cpSync(path.resolve("dist"), a, { recursive: true });
await build({
  build: { outDir: b, emptyOutDir: true, reportCompressedSize: false },
  logLevel: "error",
});
await build({
  build: { outDir: c, emptyOutDir: true, reportCompressedSize: false },
  logLevel: "error",
});
const releases = { a, b, c };
const versions = Object.fromEntries(
  [
    ["a", a],
    ["b", b],
    ["c", c],
  ].map(([name, folder]) => [
    name,
    JSON.parse(readFileSync(path.join(folder, "version.json"), "utf8")).buildId,
  ]),
);
let active = a,
  announced = versions.a,
  switchAfterPreflight = "";
const { app: api, db } = createApp({
  dbPath: path.join(dir, "test.sqlite"),
  accessKey: process.env.LEDGER_TEST_ACCESS_KEY,
});
const app = express();
// This authenticated endpoint exists only in this isolated test server.
app.post("/__test/deploy", express.json(), (req, res) => {
  if (
    req.headers.authorization !== `Bearer ${process.env.LEDGER_TEST_ACCESS_KEY}`
  )
    return res.sendStatus(401);
  const release = Object.hasOwn(releases, req.body.release)
    ? req.body.release
    : "a";
  active = releases[release];
  announced = req.body.announce || versions[release];
  switchAfterPreflight = req.body.switchAfterPreflight || "";
  res.json(versions);
});
app.get("/index.html", (req, res, next) => {
  if (!req.query.update || !switchAfterPreflight) return next();
  const body = readFileSync(path.join(active, "index.html"), "utf8");
  active = releases[switchAfterPreflight];
  announced = versions[switchAfterPreflight];
  switchAfterPreflight = "";
  res.set("Cache-Control", "no-store").type("html").send(body);
});
app.get("/version.json", (_req, res) =>
  res.set("Cache-Control", "no-store").json({ buildId: announced }),
);
app.use("/api", (req, res, next) => {
  req.url = "/api" + req.url;
  api(req, res, next);
});
// Old hashed assets remain available while deploying, as documented for production.
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  express.static(active)(req, res, next);
});
app.use(express.static(a), express.static(b), express.static(c));
app.get(/.*/, (_req, res) => res.sendFile(path.join(active, "index.html")));
const server = app.listen(3100, "127.0.0.1");
function close() {
  server.close(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
