import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

import { securityHeaders } from "./middleware/security";
import {
  GuidePage,
  HomePage,
  ManagePage,
  NotFoundPage,
  OverlayPage,
  PrivacyPage,
  SubmitPage,
} from "./ui/pages";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

type AppContext = Context<{ Bindings: Bindings; Variables: { requestId: string } }>;
type SessionStatus = "closed" | "hidden" | "open";
type LetterState = "hidden" | "new" | "used";

type SessionRow = {
  accent: string;
  created_at: number;
  expires_at: number;
  id: string;
  overlay_token_hash: string;
  owner_token_hash: string;
  prompt: string;
  selected_letter_id: string | null;
  status: SessionStatus;
  title: string;
};

type LetterRow = {
  created_at: number;
  id: string;
  message: string;
  name: string;
  state: LetterState;
};

class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 429,
  ) {
    super(code);
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: { requestId: string } }>();
const idPattern = /^[0-9a-f]{32}$/i;
const secretPattern = /^[0-9a-f]{64}$/i;
const browserSessionPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accents = new Set(["coral", "sky", "lime", "violet"]);
const reportReasons = new Set(["spam", "unsafe", "other"]);
const telemetryNames = new Set([
  "visited",
  "session_created",
  "submit_link_copied",
  "overlay_link_copied",
  "letter_sent",
  "letter_selected",
  "overlay_opened",
  "session_closed",
  "returned",
]);
const blockedLinkPattern =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|jp|io|app|dev)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;

const randomHex = (byteLength: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sameHash = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const cleanup = (db: D1Database) =>
  db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at <= unixepoch()"),
    db.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (35 * 86400)"),
  ]);

const enforceSameOrigin = (c: AppContext) => {
  const fetchSite = c.req.header("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError("cross_site_request", 403);
  }
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) {
    throw new ApiError("cross_site_request", 403);
  }
};

const parseJson = async (c: AppContext, maximumBytes: number) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("unsupported_media_type", 415);
  }
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > maximumBytes) {
    throw new ApiError("payload_too_large", 413);
  }
  const rawBody = await c.req.text();
  if (new TextEncoder().encode(rawBody).byteLength > maximumBytes) {
    throw new ApiError("payload_too_large", 413);
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};

const cleanText = (value: unknown, maximumLength: number) => {
  if (typeof value !== "string") {
    return "";
  }
  return Array.from(value.normalize("NFKC"))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
};

const getSession = (db: D1Database, sessionId: string) =>
  db
    .prepare(
      `SELECT id, owner_token_hash, overlay_token_hash, title, prompt, accent,
        status, selected_letter_id, created_at, expires_at
       FROM sessions
       WHERE id = ? AND expires_at > unixepoch()`,
    )
    .bind(sessionId)
    .first<SessionRow>();

const bearerToken = (c: AppContext) => {
  const authorization = c.req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secretPattern.test(token)) {
    throw new ApiError("access_denied", 403);
  }
  return token;
};

const requireToken = async (c: AppContext, sessionId: string, kind: "owner" | "overlay") => {
  const token = bearerToken(c);
  const session = await getSession(c.env.DB, sessionId);
  const expected = kind === "owner" ? session?.owner_token_hash : session?.overlay_token_hash;
  if (!session || !expected || !sameHash(await sha256(token), expected)) {
    throw new ApiError("access_denied", 403);
  }
  return session;
};

const publicSession = (session: SessionRow) => ({
  accent: session.accent,
  expiresAt: new Date(session.expires_at * 1000).toISOString(),
  prompt: session.prompt,
  status: session.status,
  title: session.title,
});

const isAutomatedQa = (c: AppContext) => {
  if (c.req.header("x-automated-qa") === "1") {
    return true;
  }
  const referer = c.req.header("referer");
  if (!referer) {
    return false;
  }
  try {
    return new URL(referer).searchParams.get("qa") === "1";
  } catch {
    return false;
  }
};

const noStore = (c: AppContext) => {
  c.header("Cache-Control", "private, no-store");
  c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
};

app.use("*", requestId());
app.use("*", securityHeaders);
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

app.get("/", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<HomePage />);
});

app.get("/guide", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<GuidePage />);
});

app.get("/privacy", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<PrivacyPage />);
});

app.get("/s/:sessionId", async (c) => {
  noStore(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    return c.html(<NotFoundPage />, 404);
  }
  const session = await getSession(c.env.DB, sessionId);
  if (!session || session.status === "hidden") {
    return c.html(<NotFoundPage />, 404);
  }
  return c.html(<SubmitPage sessionId={sessionId} title={session.title} />);
});

app.get("/manage/:sessionId", async (c) => {
  noStore(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    return c.html(<NotFoundPage />, 404);
  }
  const session = await getSession(c.env.DB, sessionId);
  if (!session || session.status === "hidden") {
    return c.html(<NotFoundPage />, 404);
  }
  return c.html(<ManagePage sessionId={sessionId} title={session.title} />);
});

app.get("/overlay/:sessionId", async (c) => {
  noStore(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    return c.html(<NotFoundPage />, 404);
  }
  const session = await getSession(c.env.DB, sessionId);
  if (!session || session.status === "hidden") {
    return c.html(<NotFoundPage />, 404);
  }
  return c.html(<OverlayPage sessionId={sessionId} />);
});

app.get("/api/sessions/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  const session = await getSession(c.env.DB, sessionId);
  if (!session || session.status === "hidden") {
    throw new ApiError("not_found", 404);
  }
  return c.json(publicSession(session));
});

app.post("/api/sessions", async (c) => {
  enforceSameOrigin(c);
  const payload = await parseJson(c, 4096);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_session", 400);
  }
  const source = payload as Record<string, unknown>;
  const title = cleanText(source.title, 50);
  const prompt = cleanText(source.prompt, 160);
  const accent = typeof source.accent === "string" ? source.accent : "";
  const creatorSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const website = cleanText(source.website, 100);
  if (
    !title ||
    !prompt ||
    !accents.has(accent) ||
    !browserSessionPattern.test(creatorSessionId) ||
    website ||
    blockedLinkPattern.test(title) ||
    blockedLinkPattern.test(prompt)
  ) {
    throw new ApiError("invalid_session", 400);
  }
  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM sessions
     WHERE creator_session_id = ? AND created_at > unixepoch() - 86400`,
  )
    .bind(creatorSessionId)
    .first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 10) {
    throw new ApiError("rate_limited", 429);
  }
  const sessionId = randomHex(16);
  const ownerToken = randomHex(32);
  const overlayToken = randomHex(32);
  await c.env.DB.prepare(
    `INSERT INTO sessions (
      id, owner_token_hash, overlay_token_hash, creator_session_id,
      title, prompt, accent, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), unixepoch() + (35 * 86400))`,
  )
    .bind(
      sessionId,
      await sha256(ownerToken),
      await sha256(overlayToken),
      creatorSessionId,
      title,
      prompt,
      accent,
    )
    .run();
  return c.json({ expiresInDays: 35, overlayToken, ownerToken, sessionId }, 201);
});

app.post("/api/sessions/:sessionId/letters", async (c) => {
  enforceSameOrigin(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  const session = await getSession(c.env.DB, sessionId);
  if (!session || session.status === "hidden") {
    throw new ApiError("not_found", 404);
  }
  if (session.status !== "open") {
    throw new ApiError("session_closed", 409);
  }
  const payload = await parseJson(c, 8192);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_letter", 400);
  }
  const source = payload as Record<string, unknown>;
  const name = cleanText(source.name, 24);
  const message = cleanText(source.message, 400);
  const senderSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const website = cleanText(source.website, 100);
  if (
    !message ||
    !browserSessionPattern.test(senderSessionId) ||
    website ||
    blockedLinkPattern.test(name) ||
    blockedLinkPattern.test(message)
  ) {
    throw new ApiError("invalid_letter", 400);
  }
  const counts = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COUNT(CASE WHEN sender_session_id = ? THEN 1 END) AS sender_total
     FROM letters WHERE session_id = ?`,
  )
    .bind(senderSessionId, sessionId)
    .first<{ sender_total: number; total: number }>();
  if (Number(counts?.total ?? 0) >= 100) {
    throw new ApiError("session_full", 409);
  }
  if (Number(counts?.sender_total ?? 0) >= 3) {
    throw new ApiError("rate_limited", 429);
  }
  const letterId = randomHex(16);
  await c.env.DB.prepare(
    `INSERT INTO letters (
      id, session_id, sender_session_id, name, message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  )
    .bind(letterId, sessionId, senderSessionId, name, message)
    .run();
  return c.json({ letterId, sent: true }, 201);
});

app.get("/api/sessions/:sessionId/manage", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  const session = await requireToken(c, sessionId, "owner");
  const letters = await c.env.DB.prepare(
    `SELECT id, name, message, state, created_at
     FROM letters WHERE session_id = ? ORDER BY created_at DESC`,
  )
    .bind(sessionId)
    .all<LetterRow>();
  return c.json({
    ...publicSession(session),
    letters: letters.results.map((letter) => ({
      createdAt: new Date(letter.created_at * 1000).toISOString(),
      id: letter.id,
      message: letter.message,
      name: letter.name || "匿名",
      selected: session.selected_letter_id === letter.id,
      state: letter.state,
    })),
  });
});

app.patch("/api/sessions/:sessionId/selection", async (c) => {
  enforceSameOrigin(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  await requireToken(c, sessionId, "owner");
  const payload = await parseJson(c, 1024);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_selection", 400);
  }
  const value = (payload as Record<string, unknown>).letterId;
  const letterId = value === null ? null : typeof value === "string" ? value : "";
  if (letterId !== null && !idPattern.test(letterId)) {
    throw new ApiError("invalid_selection", 400);
  }
  if (letterId) {
    const letter = await c.env.DB.prepare(
      `SELECT id FROM letters
       WHERE id = ? AND session_id = ? AND state <> 'hidden'`,
    )
      .bind(letterId, sessionId)
      .first<{ id: string }>();
    if (!letter) {
      throw new ApiError("letter_not_found", 404);
    }
  }
  await c.env.DB.prepare(
    "UPDATE sessions SET selected_letter_id = ?, updated_at = unixepoch() WHERE id = ?",
  )
    .bind(letterId, sessionId)
    .run();
  return c.json({ letterId, selected: true });
});

app.patch("/api/sessions/:sessionId/letters/:letterId", async (c) => {
  enforceSameOrigin(c);
  const sessionId = c.req.param("sessionId");
  const letterId = c.req.param("letterId");
  if (!idPattern.test(sessionId) || !idPattern.test(letterId)) {
    throw new ApiError("not_found", 404);
  }
  await requireToken(c, sessionId, "owner");
  const payload = await parseJson(c, 1024);
  const state =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>).state : "";
  if (state !== "new" && state !== "used" && state !== "hidden") {
    throw new ApiError("invalid_letter_state", 400);
  }
  const result = await c.env.DB.prepare(
    `UPDATE letters SET state = ?, updated_at = unixepoch()
     WHERE id = ? AND session_id = ?`,
  )
    .bind(state, letterId, sessionId)
    .run();
  if (result.meta.changes === 0) {
    throw new ApiError("letter_not_found", 404);
  }
  if (state === "hidden") {
    await c.env.DB.prepare(
      `UPDATE sessions SET selected_letter_id = NULL, updated_at = unixepoch()
       WHERE id = ? AND selected_letter_id = ?`,
    )
      .bind(sessionId, letterId)
      .run();
  }
  return c.json({ state, updated: true });
});

app.patch("/api/sessions/:sessionId/status", async (c) => {
  enforceSameOrigin(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  await requireToken(c, sessionId, "owner");
  const payload = await parseJson(c, 1024);
  const status =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>).status : "";
  if (status !== "open" && status !== "closed") {
    throw new ApiError("invalid_status", 400);
  }
  await c.env.DB.prepare("UPDATE sessions SET status = ?, updated_at = unixepoch() WHERE id = ?")
    .bind(status, sessionId)
    .run();
  return c.json({ status });
});

app.get("/api/sessions/:sessionId/overlay", async (c) => {
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  const session = await requireToken(c, sessionId, "overlay");
  if (!session.selected_letter_id) {
    return c.json({ accent: session.accent, letter: null });
  }
  const letter = await c.env.DB.prepare(
    `SELECT id, name, message, state, created_at FROM letters
     WHERE id = ? AND session_id = ? AND state <> 'hidden'`,
  )
    .bind(session.selected_letter_id, sessionId)
    .first<LetterRow>();
  return c.json({
    accent: session.accent,
    letter: letter ? { id: letter.id, message: letter.message, name: letter.name || "匿名" } : null,
  });
});

app.delete("/api/sessions/:sessionId", async (c) => {
  enforceSameOrigin(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  await requireToken(c, sessionId, "owner");
  await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  return c.body(null, 204);
});

app.post("/api/sessions/:sessionId/report", async (c) => {
  enforceSameOrigin(c);
  const sessionId = c.req.param("sessionId");
  if (!idPattern.test(sessionId)) {
    throw new ApiError("not_found", 404);
  }
  const session = await getSession(c.env.DB, sessionId);
  if (!session || session.status === "hidden") {
    throw new ApiError("not_found", 404);
  }
  const payload = await parseJson(c, 1024);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_report", 400);
  }
  const source = payload as Record<string, unknown>;
  const reporterSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const reason = typeof source.reason === "string" ? source.reason : "";
  if (!browserSessionPattern.test(reporterSessionId) || !reportReasons.has(reason)) {
    throw new ApiError("invalid_report", 400);
  }
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO reports
      (session_id, reporter_session_id, reason, created_at)
     VALUES (?, ?, ?, unixepoch())`,
  )
    .bind(sessionId, reporterSessionId, reason)
    .run();
  const result = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM reports WHERE session_id = ?",
  )
    .bind(sessionId)
    .first<{ count: number }>();
  if (Number(result?.count ?? 0) >= 3) {
    await c.env.DB.prepare(
      "UPDATE sessions SET status = 'hidden', updated_at = unixepoch() WHERE id = ?",
    )
      .bind(sessionId)
      .run();
  }
  return c.json({ reported: true });
});

app.post("/api/telemetry", async (c) => {
  enforceSameOrigin(c);
  if (isAutomatedQa(c)) {
    return c.body(null, 204);
  }
  const payload = await parseJson(c, 1024);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_event", 400);
  }
  const source = payload as Record<string, unknown>;
  const browserSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const name = typeof source.name === "string" ? source.name : "";
  const context = cleanText(source.context, 32);
  if (
    !browserSessionPattern.test(browserSessionId) ||
    !telemetryNames.has(name) ||
    (context !== "home" && context !== "" && !idPattern.test(context))
  ) {
    throw new ApiError("invalid_event", 400);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO product_events
       (session_id, name, context, occurred_on, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
    ).bind(browserSessionId, name, context, new Date().toISOString().slice(0, 10)),
    c.env.DB.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (35 * 86400)"),
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at <= unixepoch()"),
  ]);
  return c.body(null, 204);
});

app.get("/healthz", (c) =>
  c.json({
    healthy: true,
    service: "otayori-maku",
    time: new Date().toISOString(),
  }),
);

app.notFound((c) => {
  if (c.req.method === "GET" && !c.req.path.startsWith("/api/")) {
    return c.html(<NotFoundPage />, 404);
  }
  return c.json({ error: "not_found", requestId: c.get("requestId") }, 404);
});

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.code }, error.status);
  }
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export { app };
export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Bindings, context: ExecutionContext) {
    context.waitUntil(cleanup(env.DB));
  },
};
