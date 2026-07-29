import {
  apiJson,
  authorization,
  copyText,
  formatDate,
  isAutomatedQa,
  linkFor,
  readSecret,
  rememberSecrets,
  setStatus,
  track,
  trackVisit,
} from "./common.js";

const app = document.querySelector("#manage-app");
const id = app?.dataset.sessionId ?? "";
const owner = readSecret(id, "owner");
const overlay = readSecret(id, "overlay");
if (owner || overlay) rememberSecrets(id, { overlay, owner });

const list = document.querySelector("#manage-list");
const message = document.querySelector("#manage-message");
const preview = document.querySelector("#preview-stage");
const toggle = document.querySelector("#toggle-button");
let model = null;

const urls = {
  manage: linkFor(`/manage/${id}`, "owner", owner),
  overlay: linkFor(`/overlay/${id}`, "overlay", overlay),
  submit: linkFor(`/s/${id}`, "", ""),
};

const renderPreview = () => {
  if (!(preview instanceof HTMLElement)) return;
  preview.replaceChildren();
  const selected = model?.letters.find((letter) => letter.selected && letter.state !== "hidden");
  if (!selected) {
    const empty = document.createElement("p");
    empty.textContent = "一通選ぶと、ここに表示されます。";
    preview.append(empty);
    return;
  }
  const card = document.createElement("article");
  card.className = "stage-letter";
  const label = document.createElement("span");
  label.textContent = "おたより";
  const body = document.createElement("p");
  body.textContent = selected.message;
  const name = document.createElement("strong");
  name.textContent = `${selected.name} さん`;
  card.append(label, body, name);
  preview.append(card);
};

const actionButton = (label, className, handler) => {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
};

const updateSelection = async (letterId) => {
  try {
    await apiJson(`/api/sessions/${id}/selection`, {
      body: JSON.stringify({ letterId }),
      headers: { ...authorization(owner), "content-type": "application/json" },
      method: "PATCH",
    });
    if (letterId) track("letter_selected", id);
    await load();
  } catch {
    setStatus(message, "表示を変更できませんでした。", "error");
  }
};

const updateLetter = async (letterId, state) => {
  try {
    await apiJson(`/api/sessions/${id}/letters/${letterId}`, {
      body: JSON.stringify({ state }),
      headers: { ...authorization(owner), "content-type": "application/json" },
      method: "PATCH",
    });
    await load();
  } catch {
    setStatus(message, "おたよりの状態を変更できませんでした。", "error");
  }
};

const render = () => {
  document.documentElement.dataset.accent = model.accent;
  const state = document.querySelector("#manage-state");
  const total = document.querySelector("#letter-total");
  if (state) {
    state.textContent =
      model.status === "open" ? `受付中・${formatDate(model.expiresAt)}まで` : "受付終了";
  }
  if (total) {
    total.textContent = `${model.letters.filter((letter) => letter.state !== "hidden").length}通`;
  }
  if (toggle) toggle.textContent = model.status === "open" ? "受付を閉じる" : "受付を再開";
  if (!(list instanceof HTMLElement)) return;
  list.replaceChildren();
  const visible = model.letters.filter((letter) => letter.state !== "hidden");
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "おたよりを待っています。";
    list.append(empty);
  }
  visible.forEach((letter) => {
    const card = document.createElement("article");
    card.className = "manage-letter";
    if (letter.selected) card.dataset.selected = "true";
    if (letter.state === "used") card.dataset.used = "true";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = letter.name;
    const body = document.createElement("p");
    body.textContent = letter.message;
    const time = document.createElement("small");
    time.textContent = new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    }).format(new Date(letter.createdAt));
    copy.append(name, body, time);
    const actions = document.createElement("div");
    actions.className = "letter-actions";
    actions.append(
      actionButton(letter.selected ? "表示中" : "表示", "select-button", () =>
        updateSelection(letter.id),
      ),
      actionButton(letter.state === "used" ? "未読へ" : "読了", "text-button", () =>
        updateLetter(letter.id, letter.state === "used" ? "new" : "used"),
      ),
      actionButton("隠す", "text-button danger", () => updateLetter(letter.id, "hidden")),
    );
    card.append(copy, actions);
    list.append(card);
  });
  renderPreview();
};

const load = async () => {
  if (!owner) throw new Error("missing_owner");
  model = await apiJson(`/api/sessions/${id}/manage`, {
    headers: authorization(owner),
  });
  render();
};

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const kind = button.dataset.copy;
    const value = urls[kind];
    if (!value || (kind === "overlay" && !overlay) || (kind === "manage" && !owner)) {
      setStatus(message, "この端末に秘密鍵が残っていません。", "error");
      return;
    }
    try {
      await copyText(value);
      const label = button.closest("article")?.querySelector("strong")?.textContent ?? "URL";
      setStatus(message, `${label}をコピーしました。`, "success");
      if (kind === "submit") track("submit_link_copied", id);
      if (kind === "overlay") track("overlay_link_copied", id);
    } catch {
      setStatus(message, "コピーできませんでした。", "error");
    }
  });
});

document.querySelector("#refresh-button")?.addEventListener("click", () => {
  load().catch(() => setStatus(message, "更新できませんでした。", "error"));
});
document.querySelector("#clear-button")?.addEventListener("click", () => updateSelection(null));

toggle?.addEventListener("click", async () => {
  if (!model) return;
  const status = model.status === "open" ? "closed" : "open";
  try {
    await apiJson(`/api/sessions/${id}/status`, {
      body: JSON.stringify({ status }),
      headers: { ...authorization(owner), "content-type": "application/json" },
      method: "PATCH",
    });
    if (status === "closed") track("session_closed", id);
    await load();
  } catch {
    setStatus(message, "受付状態を変更できませんでした。", "error");
  }
});

document.querySelector("#delete-button")?.addEventListener("click", async () => {
  if (!confirm("受付とすべてのおたよりを削除します。元に戻せません。")) return;
  try {
    await apiJson(`/api/sessions/${id}`, {
      headers: authorization(owner),
      method: "DELETE",
    });
    location.assign(isAutomatedQa ? "/?qa=1" : "/");
  } catch {
    setStatus(message, "削除できませんでした。", "error");
  }
});

load().catch(() => {
  setStatus(message, "管理鍵を確認できません。作成時に開いた管理URLを使ってください。", "error");
});
const refreshTimer = window.setInterval(() => {
  if (!document.hidden) void load().catch(() => {});
}, 5000);
window.addEventListener("pagehide", () => clearInterval(refreshTimer));
trackVisit(id);
