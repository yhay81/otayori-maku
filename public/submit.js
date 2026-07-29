import { apiJson, sessionId, setStatus, track, trackVisit } from "./common.js";

const app = document.querySelector("#submit-app");
const id = app?.dataset.sessionId ?? "";
const form = document.querySelector("#letter-form");
const message = document.querySelector("#letter-message");
const count = document.querySelector("#letter-count");
const status = document.querySelector("#letter-status");
const button = document.querySelector("#send-button");

const setDisabled = (value) => {
  form?.querySelectorAll("input, textarea, button").forEach((element) => {
    element.disabled = value;
  });
};

const load = async () => {
  const data = await apiJson(`/api/sessions/${id}`);
  document.documentElement.dataset.accent = data.accent;
  document.querySelector("#session-title").textContent = data.title;
  document.querySelector("#session-prompt").textContent = data.prompt;
  document.querySelector("#session-state").textContent =
    data.status === "open" ? "受付中" : "受付終了";
  if (data.status !== "open") {
    setDisabled(true);
    setStatus(status, "この受付は終了しました。");
  }
};

message?.addEventListener("input", () => {
  if (count) count.textContent = `${message.value.length} / 400`;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    !(form instanceof HTMLFormElement) ||
    !(button instanceof HTMLButtonElement) ||
    !form.reportValidity()
  ) {
    return;
  }
  button.disabled = true;
  setStatus(status, "送っています…");
  try {
    await apiJson(`/api/sessions/${id}/letters`, {
      body: JSON.stringify({
        message: message?.value ?? "",
        name: document.querySelector("#letter-name")?.value ?? "",
        sessionId,
        website: document.querySelector("#letter-website")?.value ?? "",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    track("letter_sent", id);
    form.reset();
    if (count) count.textContent = "0 / 400";
    setStatus(status, "おたよりを送りました。", "success");
  } catch (error) {
    const errorMessages = {
      invalid_letter: "内容を確認してください。URLや連絡先は送れません。",
      rate_limited: "この受付には3通まで送れます。",
      session_closed: "この受付は終了しました。",
      session_full: "100通集まったため受付を終了しました。",
    };
    setStatus(status, errorMessages[error.message] ?? "送れませんでした。", "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#report-button")?.addEventListener("click", async () => {
  if (!confirm("この受付を不適切な内容として報告しますか？")) return;
  try {
    await apiJson(`/api/sessions/${id}/report`, {
      body: JSON.stringify({ reason: "unsafe", sessionId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setStatus(status, "報告を受け付けました。", "success");
  } catch {
    setStatus(status, "報告できませんでした。", "error");
  }
});

load().catch(() => {
  setDisabled(true);
  setStatus(status, "受付を読み込めませんでした。URLを確認してください。", "error");
});
trackVisit(id);
