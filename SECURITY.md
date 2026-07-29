# Security

## Controls

- 128-bit session ID、別々の256-bit owner/overlay capability key
- D1に鍵のSHA-256 hashだけを保存し、定時間比較
- same-origin write、JSON content type、body size、文字数、列挙値を検証
- URL、メールアドレス、制御文字、honeypot入力を拒否
- 1受付100通、1匿名ブラウザ3通、1匿名ブラウザ1日10受付
- 管理者による個別非表示・全削除、3匿名セッション報告後の受付非表示
- private routeの`noindex`/`no-store`、CSP、HSTS、nosniff、frame deny
- JSXとDOM `textContent`だけで利用者入力を表示
- scheduled cleanupで本文・イベントを35日保持

## Capability boundary

公開APIは番組名、募集文、状態だけを返します。管理APIはowner keyだけ、OBS APIはoverlay keyだけを受け入れます。OBS APIは選択済みで非表示ではない一通だけを返し、一覧や管理状態を返しません。

## Reporting

秘密鍵の漏えいや脆弱性は公開issueへ本文を貼らず、GitHub Security Advisoryのprivate reportを利用してください。
