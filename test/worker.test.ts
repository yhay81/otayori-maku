import { beforeEach, describe, expect, it, vi } from "vitest";

import { app, type Bindings } from "../src/worker";

const sessionId = "a".repeat(32);
const letterId = "b".repeat(32);
const browserSessionId = "7c0dbe70-8c47-4fc0-aa62-52427133c612";
const ownerToken = "1".repeat(64);
const overlayToken = "2".repeat(64);

type TestState = {
  letterCounts?: { sender_total: number; total: number };
  letters?: Array<{
    created_at: number;
    id: string;
    message: string;
    name: string;
    state: "hidden" | "new" | "used";
  }>;
  recentSessions?: number;
  reportCount?: number;
  session?: {
    accent: string;
    created_at: number;
    expires_at: number;
    id: string;
    overlay_token_hash: string;
    owner_token_hash: string;
    prompt: string;
    selected_letter_id: string | null;
    status: "closed" | "hidden" | "open";
    title: string;
  } | null;
  updateChanges?: number;
};

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const defaultState = async (status: "closed" | "hidden" | "open" = "open"): Promise<TestState> => ({
  letterCounts: { sender_total: 0, total: 1 },
  letters: [
    {
      created_at: Math.floor(Date.now() / 1000),
      id: letterId,
      message: "活動1周年、おめでとうございます！",
      name: "月見だんご",
      state: "new",
    },
  ],
  session: {
    accent: "coral",
    created_at: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 86_400,
    id: sessionId,
    overlay_token_hash: await hash(overlayToken),
    owner_token_hash: await hash(ownerToken),
    prompt: "最近買ってよかったものを教えてください",
    selected_letter_id: letterId,
    status,
    title: "金曜よるの雑談",
  },
});

const makeBindings = (state: TestState = {}) => {
  const calls: Array<{ arguments: unknown[]; sql: string }> = [];
  const batch = vi.fn(() => Promise.resolve([]));
  const prepare = vi.fn((sql: string) => {
    const call = { arguments: [] as unknown[], sql };
    calls.push(call);
    const statement = {
      all: vi.fn(async () => {
        if (sql.includes("FROM letters")) {
          return { results: state.letters ?? [] };
        }
        return { results: [] };
      }),
      bind: vi.fn((...arguments_: unknown[]) => {
        call.arguments = arguments_;
        return statement;
      }),
      first: vi.fn(async () => {
        if (sql.includes("COUNT(*) AS count FROM sessions")) {
          return { count: state.recentSessions ?? 0 };
        }
        if (sql.includes("sender_total")) {
          return state.letterCounts ?? { sender_total: 0, total: 0 };
        }
        if (sql.includes("COUNT(*) AS count FROM reports")) {
          return { count: state.reportCount ?? 1 };
        }
        if (sql.includes("SELECT id FROM letters")) {
          return state.letters?.find((letter) => letter.id === call.arguments[0]) ?? null;
        }
        if (sql.includes("SELECT id, name, message, state, created_at FROM letters")) {
          return state.letters?.find((letter) => letter.id === call.arguments[0]) ?? null;
        }
        if (sql.includes("FROM sessions")) {
          return state.session ?? null;
        }
        return null;
      }),
      run: vi.fn(() =>
        Promise.resolve({
          meta: { changes: state.updateChanges ?? 1 },
          success: true,
        }),
      ),
    };
    return statement;
  });
  return {
    batch,
    bindings: {
      ASSETS: { fetch: () => Promise.resolve(new Response("not used")) },
      DB: { batch, prepare },
    } as unknown as Bindings,
    calls,
  };
};

const sameOriginHeaders = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
};

describe("おたより幕 worker", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders a product-led control surface without experiment copy or giant text", async () => {
    const { bindings } = makeBindings();
    const response = await app.request("/", undefined, bindings);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(html).toContain('lang="ja"');
    expect(html).toContain('id="create-form"');
    expect(html).toContain('class="console-demo"');
    expect(html).toContain("OBS BROWSER");
    expect(html).toContain("届く。選ぶ。映す。");
    expect(html).not.toContain("成功条件");
    expect(html).not.toContain("仮説");
    expect(html).not.toContain('class="hero"');
  });

  it("renders all private surfaces with noindex and no-store", async () => {
    const state = await defaultState();
    const { bindings } = makeBindings(state);

    for (const path of [`/s/${sessionId}`, `/manage/${sessionId}`, `/overlay/${sessionId}`]) {
      const response = await app.request(path, undefined, bindings);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(html).toContain('content="noindex,nofollow,noarchive"');
      expect(html).toContain(`data-session-id="${sessionId}"`);
    }
  });

  it("does not expose hidden or missing sessions", async () => {
    const state = await defaultState("hidden");
    const { bindings } = makeBindings(state);
    const response = await app.request(`/s/${sessionId}`, undefined, bindings);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("この受付は見つかりません");
  });

  it("creates separate owner and overlay secrets", async () => {
    const { bindings, calls } = makeBindings();
    const response = await app.request(
      "/api/sessions",
      {
        body: JSON.stringify({
          accent: "coral",
          prompt: "最近買ってよかったものを教えてください",
          sessionId: browserSessionId,
          title: "金曜よるの雑談",
          website: "",
        }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );
    const body = await response.json<{
      overlayToken: string;
      ownerToken: string;
      sessionId: string;
    }>();

    expect(response.status).toBe(201);
    expect(body.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(body.ownerToken).toMatch(/^[0-9a-f]{64}$/);
    expect(body.overlayToken).toMatch(/^[0-9a-f]{64}$/);
    expect(body.ownerToken).not.toBe(body.overlayToken);
    expect(calls.some((call) => call.sql.includes("INSERT INTO sessions"))).toBe(true);
    const insert = calls.find((call) => call.sql.includes("INSERT INTO sessions"));
    expect(insert?.arguments).not.toContain(body.ownerToken);
    expect(insert?.arguments).not.toContain(body.overlayToken);
  });

  it("rejects cross-site creation, honeypots, links, and high creation volume", async () => {
    const { bindings } = makeBindings({ recentSessions: 10 });
    const base = {
      accent: "coral",
      prompt: "おたよりをください",
      sessionId: browserSessionId,
      title: "雑談配信",
      website: "",
    };
    const crossSite = await app.request(
      "/api/sessions",
      {
        body: JSON.stringify(base),
        headers: { ...sameOriginHeaders, "sec-fetch-site": "cross-site" },
        method: "POST",
      },
      bindings,
    );
    const trap = await app.request(
      "/api/sessions",
      {
        body: JSON.stringify({ ...base, website: "bot" }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );
    const link = await app.request(
      "/api/sessions",
      {
        body: JSON.stringify({ ...base, prompt: "https://example.com を見て" }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );
    const limited = await app.request(
      "/api/sessions",
      {
        body: JSON.stringify(base),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );

    expect(crossSite.status).toBe(403);
    expect(trap.status).toBe(400);
    expect(link.status).toBe(400);
    expect(limited.status).toBe(429);
  });

  it("keeps letter content out of the public session response", async () => {
    const state = await defaultState();
    const { bindings } = makeBindings(state);
    const response = await app.request(`/api/sessions/${sessionId}`, undefined, bindings);
    const body = await response.json<Record<string, unknown>>();

    expect(response.status).toBe(200);
    expect(body.title).toBe("金曜よるの雑談");
    expect(body).not.toHaveProperty("letters");
    expect(JSON.stringify(body)).not.toContain("月見だんご");
  });

  it("accepts a valid anonymous letter and enforces capacity limits", async () => {
    const state = await defaultState();
    const validBindings = makeBindings(state).bindings;
    const valid = await app.request(
      `/api/sessions/${sessionId}/letters`,
      {
        body: JSON.stringify({
          message: "活動1周年、おめでとうございます！",
          name: "月見だんご",
          sessionId: browserSessionId,
          website: "",
        }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      validBindings,
    );
    const fullState = await defaultState();
    fullState.letterCounts = { sender_total: 0, total: 100 };
    const full = await app.request(
      `/api/sessions/${sessionId}/letters`,
      {
        body: JSON.stringify({
          message: "おめでとうございます",
          name: "",
          sessionId: browserSessionId,
          website: "",
        }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      makeBindings(fullState).bindings,
    );

    expect(valid.status).toBe(201);
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: "session_full" });
  });

  it("rejects URLs and a fourth letter from the same browser", async () => {
    const state = await defaultState();
    state.letterCounts = { sender_total: 3, total: 3 };
    const { bindings } = makeBindings(state);
    const linked = await app.request(
      `/api/sessions/${sessionId}/letters`,
      {
        body: JSON.stringify({
          message: "詳しくは example.com",
          name: "",
          sessionId: browserSessionId,
          website: "",
        }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );
    const limited = await app.request(
      `/api/sessions/${sessionId}/letters`,
      {
        body: JSON.stringify({
          message: "四通目です",
          name: "",
          sessionId: browserSessionId,
          website: "",
        }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(linked.status).toBe(400);
    expect(limited.status).toBe(429);
  });

  it("allows only the owner key to read management data", async () => {
    const state = await defaultState();
    const { bindings } = makeBindings(state);
    const owner = await app.request(
      `/api/sessions/${sessionId}/manage`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
      bindings,
    );
    const overlay = await app.request(
      `/api/sessions/${sessionId}/manage`,
      { headers: { authorization: `Bearer ${overlayToken}` } },
      bindings,
    );
    const body = await owner.json<{ letters: Array<{ message: string }> }>();

    expect(owner.status).toBe(200);
    expect(body.letters[0]?.message).toContain("1周年");
    expect(overlay.status).toBe(403);
  });

  it("allows only the overlay key and returns only the selected visible letter", async () => {
    const state = await defaultState();
    const { bindings } = makeBindings(state);
    const overlay = await app.request(
      `/api/sessions/${sessionId}/overlay`,
      { headers: { authorization: `Bearer ${overlayToken}` } },
      bindings,
    );
    const owner = await app.request(
      `/api/sessions/${sessionId}/overlay`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
      bindings,
    );
    const body = await overlay.json<{
      letter: { message: string; name: string };
    }>();

    expect(overlay.status).toBe(200);
    expect(body.letter).toEqual({
      id: letterId,
      message: "活動1周年、おめでとうございます！",
      name: "月見だんご",
    });
    expect(owner.status).toBe(403);
    expect(JSON.stringify(body)).not.toContain("created_at");
  });

  it("requires the owner key to select, close, hide, and delete", async () => {
    const state = await defaultState();
    const { bindings, calls } = makeBindings(state);
    const responses = [
      await app.request(
        `/api/sessions/${sessionId}/selection`,
        {
          body: JSON.stringify({ letterId }),
          headers: {
            ...sameOriginHeaders,
            authorization: `Bearer ${ownerToken}`,
          },
          method: "PATCH",
        },
        bindings,
      ),
      await app.request(
        `/api/sessions/${sessionId}/status`,
        {
          body: JSON.stringify({ status: "closed" }),
          headers: {
            ...sameOriginHeaders,
            authorization: `Bearer ${ownerToken}`,
          },
          method: "PATCH",
        },
        bindings,
      ),
      await app.request(
        `/api/sessions/${sessionId}/letters/${letterId}`,
        {
          body: JSON.stringify({ state: "hidden" }),
          headers: {
            ...sameOriginHeaders,
            authorization: `Bearer ${ownerToken}`,
          },
          method: "PATCH",
        },
        bindings,
      ),
      await app.request(
        `/api/sessions/${sessionId}`,
        {
          headers: {
            authorization: `Bearer ${ownerToken}`,
            "sec-fetch-site": "same-origin",
          },
          method: "DELETE",
        },
        bindings,
      ),
    ];
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 204]);
    expect(calls.some((call) => call.sql.includes("selected_letter_id = ?"))).toBe(true);
    expect(calls.some((call) => call.sql.includes("DELETE FROM sessions"))).toBe(true);
  });

  it("auto-hides a session after the third distinct report", async () => {
    const state = await defaultState();
    state.reportCount = 3;
    const { bindings, calls } = makeBindings(state);
    const response = await app.request(
      `/api/sessions/${sessionId}/report`,
      {
        body: JSON.stringify({
          reason: "unsafe",
          sessionId: browserSessionId,
        }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.sql.includes("status = 'hidden'"))).toBe(true);
  });

  it("does not record automated QA telemetry", async () => {
    const { batch, bindings } = makeBindings();
    const response = await app.request(
      "/api/telemetry",
      {
        body: JSON.stringify({
          context: "home",
          name: "visited",
          sessionId: browserSessionId,
        }),
        headers: { ...sameOriginHeaders, "x-automated-qa": "1" },
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(204);
    expect(batch).not.toHaveBeenCalled();
  });

  it("records valid telemetry with 35-day cleanup", async () => {
    const { batch, bindings, calls } = makeBindings();
    const response = await app.request(
      "/api/telemetry",
      {
        body: JSON.stringify({
          context: sessionId,
          name: "letter_selected",
          sessionId: browserSessionId,
        }),
        headers: sameOriginHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(204);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("DELETE FROM product_events") && call.sql.includes("35 * 86400"),
      ),
    ).toBe(true);
  });

  it("returns JSON request ids for missing API routes", async () => {
    const { bindings } = makeBindings();
    const response = await app.request("/api/missing", undefined, bindings);
    const body = await response.json<{ error: string; requestId: string }>();
    expect(response.status).toBe(404);
    expect(body.error).toBe("not_found");
    expect(body.requestId).toBeTruthy();
  });
});
