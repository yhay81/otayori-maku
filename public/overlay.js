import { apiJson, authorization, readSecret, track } from "./common.js";

const app = document.querySelector("#overlay-app");
const id = app?.dataset.sessionId ?? "";
const token = readSecret(id, "overlay");
const card = document.querySelector("#overlay-letter");
const body = document.querySelector("#overlay-message");
const name = document.querySelector("#overlay-name");
let previousId = "";

const load = async () => {
  if (!token) return;
  const data = await apiJson(`/api/sessions/${id}/overlay`, {
    headers: authorization(token),
  });
  document.documentElement.dataset.accent = data.accent;
  if (!data.letter) {
    card?.setAttribute("hidden", "");
    previousId = "";
    return;
  }
  if (body) body.textContent = data.letter.message;
  if (name) name.textContent = `${data.letter.name} さん`;
  if (data.letter.id !== previousId) {
    card?.removeAttribute("hidden");
    previousId = data.letter.id;
  }
};

track("overlay_opened", id);
load().catch(() => {});
const timer = window.setInterval(() => void load().catch(() => {}), 2500);
window.addEventListener("pagehide", () => clearInterval(timer));
