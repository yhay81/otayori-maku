# Privacy

## Product data

D1へ番組名、募集文、差し色、任意の表示名、400字以内のおたより本文、受付・選択状態を保存します。受付は推測困難な128-bit IDで共有し、公開一覧やsitemapへ載せません。

受付と本文は作成から35日後に削除します。管理URLから即時削除、個別非表示もできます。

## Capability keys

管理鍵とOBS表示鍵は別の256-bit値です。D1にはSHA-256 hashだけを保存します。鍵はURLのfragmentに含めるため通常のHTTPリクエスト、Referer、アクセスログへ送られません。ブラウザは必要なAPIへBearer tokenとして渡します。

## Anonymous telemetry

Cookieは使いません。ブラウザのlocalStorageにランダムUUIDを作り、訪問、作成、URLコピー、送信、選択、OBS表示、締切、別日再訪の操作名と発生日を35日以内保存します。本文、表示名、IPアドレス、User-Agentはイベントへ含めません。
