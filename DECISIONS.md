# Decisions

## 2026-07-30 — Narrow one-stream inbox

- Decision: HARIやtobasoの多機能な継続運用を再現せず、一配信の受付・選択・OBS表示に限定する
- Reason: 競合は広いジョブをすでに解決しており、登録や長期管理を持たない短期利用だけが検証可能な差分

## 2026-07-30 — Capability URLs, no Better Auth

- Decision: Better Authを導入せず、受付ごとに管理鍵とOBS鍵を別々に発行する
- Reason: 視聴者も配信者も単発利用でき、アカウント復旧や本人情報保有を避けられる
- Boundary: 管理鍵は全操作、OBS鍵は選択済み一通の読み取りだけ。鍵はURL fragmentに置き、D1にはSHA-256 hashだけを保存する

## 2026-07-30 — Short retention

- Decision: 受付、本文、匿名イベントを35日で削除する
- Reason: 一配信の道具に長期履歴は不要で、漏えい時の影響と運用責任を小さくできる

## 2026-07-30 — Canonical delivery

- Decision: 正規URLを`https://otayori-maku.yhay81.com`とし、`workers.dev`とpreview URLを無効にする
- Reason: yhay81.com配下へ入口を統一し、移管可能な構成にする
