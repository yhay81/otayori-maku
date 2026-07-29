# Stack

- Runtime: Cloudflare Workers
- HTTP/UI: Hono、Hono JSX
- Build: Vite+、TypeScript
- Persistence: Cloudflare D1
- Delivery: `otayori-maku.yhay81.com` custom domain
- Authentication: Better Authなし。受付単位のowner/overlay capability key
- Quality: Vitest、Oxlint、Oxfmt、TypeScript

Better Authは継続プロフィール、履歴同期、課金管理が必要になったときだけ再評価します。現時点では単発利用の摩擦と本人情報保有責任の方が大きいため採用しません。
