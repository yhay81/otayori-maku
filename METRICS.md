# Metrics

業務行を正本にし、訪問、URLコピー、選択、OBS表示、別日再訪だけを匿名イベントで補います。自動QAは`?qa=1`、WebDriver、`x-automated-qa`で除外します。

| Metric                      | Source                      | Meaning                   |
| --------------------------- | --------------------------- | ------------------------- |
| `users`                     | distinct `visited` session  | 匿名訪問者                |
| `sessions_created`          | `sessions`                  | 作成された実受付          |
| `submit_links_copied`       | distinct event context      | 受付URLをコピーした受付   |
| `overlay_links_copied`      | distinct event context      | OBS URLをコピーした受付   |
| `letters_sent`              | visible `letters`           | 送信されたおたより        |
| `sessions_with_letters`     | letter aggregation          | 1通以上届いた受付         |
| `sessions_with_ten_letters` | letter aggregation          | 10通以上届いた受付        |
| `sessions_with_selection`   | distinct event context      | 一通以上選んだ受付        |
| `sessions_with_overlay`     | distinct event context      | OBS表示を開いた受付       |
| `repeat_hosts`              | creator aggregation         | 2受付以上作った匿名配信者 |
| `returned`                  | distinct `returned` session | 別日に再訪した匿名利用者  |

本文、表示名、IPアドレス、User-Agentはイベントへ記録しません。ブラウザ生成UUID、操作名、受付IDまたは`home`、発生日だけを35日以内保存します。
