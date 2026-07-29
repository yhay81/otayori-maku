# おたより幕

配信のおたよりを登録なしで集め、選んだ一通だけをOBSへ映す小さな受付です。

- サービス: <https://otayori-maku.yhay81.com>
- 使い方: <https://otayori-maku.yhay81.com/guide>
- プライバシー: <https://otayori-maku.yhay81.com/privacy>

## Product boundary

配信者は番組名と募集文を入力し、受付URL、管理URL、OBS表示URLを受け取ります。視聴者は受付URLから任意の表示名と400字以内の本文を送信できます。管理画面では一通を選択、読了、非表示にでき、OBS表示URLでは選択済みの一通だけを読み取れます。

アカウント、メール、Cookie、画像、投げ銭、公開一覧は扱いません。受付と本文は35日後に自動削除します。

## Development

Node.js 24 LTSとnpmを使います。

```powershell
npm ci
npx wrangler d1 migrations apply otayori-maku --local
npm run dev
```

検査:

```powershell
npm run release:check
npm run check
npm test
npm run build
npm audit --omit=dev
```

本番:

```powershell
npx wrangler d1 migrations apply otayori-maku --remote
npm run deploy
npm run indexnow
npm run metrics
```

## Stack

Cloudflare Workers / D1、Hono JSX、Vite+、TypeScript。認証基盤は持たず、受付ごとの256-bit capability keyで管理権限とOBS読み取り権限を分離します。
