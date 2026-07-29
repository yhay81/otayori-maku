import { apiJson, isAutomatedQa, sessionId, setStatus, track, trackVisit } from "./common.js";

const form = document.querySelector("#create-form");
const prompt = document.querySelector("#prompt");
const count = document.querySelector("#prompt-count");
const status = document.querySelector("#create-status");
const button = document.querySelector("#create-button");

prompt?.addEventListener("input", () => {
  if (count) count.textContent = `${prompt.value.length} / 160`;
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
  setStatus(status, "受付を準備しています…");
  const accent = form.querySelector('input[name="accent"]:checked')?.value ?? "coral";
  try {
    const result = await apiJson("/api/sessions", {
      body: JSON.stringify({
        accent,
        prompt: prompt?.value ?? "",
        sessionId,
        title: document.querySelector("#title")?.value ?? "",
        website: document.querySelector("#website")?.value ?? "",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    track("session_created", result.sessionId);
    const query = isAutomatedQa ? "?qa=1" : "";
    const hash = new URLSearchParams({
      overlay: result.overlayToken,
      owner: result.ownerToken,
    });
    location.assign(`/manage/${result.sessionId}${query}#${hash}`);
  } catch (error) {
    const errorMessages = {
      invalid_session: "番組名と募集文を確認してください。URLや連絡先は入れられません。",
      rate_limited: "今日はすでに10件作成しています。明日もう一度お試しください。",
    };
    setStatus(
      status,
      errorMessages[error.message] ??
        "受付を作れませんでした。少し待ってからもう一度お試しください。",
      "error",
    );
    button.disabled = false;
  }
});

trackVisit("home");
