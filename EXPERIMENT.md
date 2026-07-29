# おたより幕 public pilot

## Decision

- Status: 30-day public pilot
- Review deadline: 2026-08-29
- Investment decision: hold
- Target: 月に数回配信し、フォームやチャットから読むおたよりを手作業で整理している日本語の小規模配信者
- Existing alternatives: HARI、tobaso、汎用フォーム

HARIとtobasoは広い用途をすでに高い品質で解決しています。このpilotは正面から置き換えず、「登録なし・一配信だけ・35日で消える・管理鍵とOBS鍵を分離」という狭い入口に実需要があるかだけを確かめます。

## Falsifiable outcome

- Continue: 実配信者3人以上、実受付3件以上、おたより30通以上、選択10回以上またはOBSを開いた受付3件以上、複数日または複数受付を使った配信者2人以上
- Hold: 30日後も実受付2件未満、またはおたより5通未満、またはOBSを開いた受付が0件
- Automated QA、自己テスト、訪問だけのセッションは実利用に数えない

獲得は検索、Tool Shelf、利用者自身による自然なURL共有に限定します。許可のないDM、メール、SNS投稿は行いません。

## Safety boundary

- 受付、管理、OBSのURLを分離し、管理鍵でOBS APIを読めず、OBS鍵で管理APIを読めない
- 鍵はhash化して保存し、URL fragmentからBearerへ渡す
- 本文にURL、メールアドレス、制御文字を許可しない
- 1受付100通、1ブラウザ3通、1ブラウザ1日10受付
- 3つの異なる匿名セッションから報告された受付を非表示にする
- 本文、IPアドレス、User-Agentを計測データに入れない
