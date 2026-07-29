import { product } from "../config/product";
import { Layout } from "./layout";

function LetterCard({
  active = false,
  message,
  name,
}: {
  active?: boolean;
  message: string;
  name: string;
}) {
  return (
    <article class={`demo-letter${active ? " active" : ""}`}>
      <span class="letter-avatar" aria-hidden="true"></span>
      <div>
        <strong>{name}</strong>
        <p>{message}</p>
      </div>
      <i aria-hidden="true"></i>
    </article>
  );
}

export function HomePage() {
  return (
    <Layout>
      <section class="console-demo" aria-label="おたより幕の操作イメージ">
        <div class="demo-inbox">
          <header>
            <span class="window-dots" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <strong>受信トレイ</strong>
            <span class="count-badge">3</span>
          </header>
          <div class="letter-stack">
            <LetterCard message="最近買ってよかった配信機材はありますか？" name="しおり" />
            <LetterCard active message="活動1周年、おめでとうございます！" name="月見だんご" />
            <LetterCard message="夏に遊びたいゲームを教えてください。" name="匿名" />
          </div>
        </div>
        <div class="demo-switch" aria-hidden="true">
          <span>選ぶ</span>
          <i></i>
        </div>
        <div class="demo-stage">
          <header>
            <span>OBS BROWSER</span>
            <i class="live-dot"></i>
            <small>LIVE</small>
          </header>
          <div class="stage-grid">
            <div class="stage-letter">
              <span>おたより</span>
              <p>活動1周年、おめでとうございます！</p>
              <strong>月見だんご さん</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="maker-shell" id="create">
        <div class="maker-intro">
          <span class="eyebrow">ONE STREAM / NO ACCOUNT</span>
          <h1>{product.headline}</h1>
          <p>今度の配信で読むテーマを決めたら、受付URLとOBS用URLがすぐできます。</p>
          <ul>
            <li>
              <span>01</span>視聴者は登録なし
            </li>
            <li>
              <span>02</span>OBSには選んだ一通だけ
            </li>
            <li>
              <span>03</span>35日後に自動削除
            </li>
          </ul>
        </div>
        <form class="maker" id="create-form">
          <header>
            <span class="mini-window" aria-hidden="true"></span>
            <div>
              <small>NEW INBOX</small>
              <h2>今夜の受付をつくる</h2>
            </div>
          </header>
          <label class="field">
            <span>番組・配信名</span>
            <input
              autocomplete="off"
              id="title"
              maxlength={50}
              placeholder="金曜よるの雑談"
              required
              type="text"
            />
          </label>
          <label class="field">
            <span>募集するおたより</span>
            <textarea
              id="prompt"
              maxlength={160}
              placeholder="最近買ってよかったものを教えてください"
              required
              rows={3}
            ></textarea>
            <small class="counter" id="prompt-count">
              0 / 160
            </small>
          </label>
          <fieldset class="accent-picker">
            <legend>画面の差し色</legend>
            {[
              ["coral", "コーラル"],
              ["sky", "スカイ"],
              ["lime", "ライム"],
              ["violet", "バイオレット"],
            ].map(([value, label], index) => (
              <label>
                <input checked={index === 0} name="accent" type="radio" value={value} />
                <span class={`swatch ${value}`}>{label}</span>
              </label>
            ))}
          </fieldset>
          <label class="honeypot" aria-hidden="true">
            Website
            <input autocomplete="off" id="website" tabindex={-1} type="text" />
          </label>
          <button class="button primary" id="create-button" type="submit">
            3つのURLをつくる
            <span aria-hidden="true">→</span>
          </button>
          <p class="action-status" id="create-status" aria-live="polite"></p>
        </form>
      </section>
      <script src="/home.js?v=1" type="module"></script>
    </Layout>
  );
}

export function SubmitPage({ sessionId, title }: { sessionId: string; title: string }) {
  return (
    <Layout
      canonical={`${product.url}/s/${sessionId}`}
      noindex
      title={`${title} | ${product.name}`}
      bodyClass="private-page"
    >
      <section class="submit-shell" data-session-id={sessionId} id="submit-app">
        <div class="submit-card">
          <header class="topic-ticket">
            <span>OPEN LETTERS</span>
            <i></i>
            <small id="session-state">受付中</small>
          </header>
          <div class="topic-copy">
            <small id="session-title">{title}</small>
            <h1 id="session-prompt">おたよりを読み込んでいます</h1>
          </div>
          <form id="letter-form">
            <label class="field">
              <span>
                お名前 <small>任意</small>
              </span>
              <input
                autocomplete="nickname"
                id="letter-name"
                maxlength={24}
                placeholder="匿名"
                type="text"
              />
            </label>
            <label class="field">
              <span>おたより</span>
              <textarea
                id="letter-message"
                maxlength={400}
                placeholder="配信者に届けたい内容を書いてください"
                required
                rows={7}
              ></textarea>
              <small class="counter" id="letter-count">
                0 / 400
              </small>
            </label>
            <label class="honeypot" aria-hidden="true">
              Website
              <input autocomplete="off" id="letter-website" tabindex={-1} type="text" />
            </label>
            <button class="button primary" id="send-button" type="submit">
              おたよりを送る
              <span aria-hidden="true">↗</span>
            </button>
            <p class="form-note">URL・連絡先・個人情報は書かないでください</p>
            <p class="action-status" id="letter-status" aria-live="polite"></p>
          </form>
          <button class="report-link" id="report-button" type="button">
            この受付を報告
          </button>
        </div>
      </section>
      <script src="/submit.js?v=1" type="module"></script>
    </Layout>
  );
}

export function ManagePage({ sessionId, title }: { sessionId: string; title: string }) {
  return (
    <Layout
      canonical={`${product.url}/manage/${sessionId}`}
      noindex
      title={`管理 | ${title} | ${product.name}`}
      bodyClass="private-page"
    >
      <section class="manage-shell" data-session-id={sessionId} id="manage-app">
        <header class="manage-header">
          <div>
            <span class="eyebrow">CONTROL ROOM</span>
            <h1>{title}</h1>
          </div>
          <div class="manage-status">
            <i></i>
            <span id="manage-state">接続中</span>
          </div>
        </header>
        <div class="link-console">
          <article>
            <span class="link-number">01</span>
            <div>
              <small>視聴者へ</small>
              <strong>受付URL</strong>
            </div>
            <button class="button compact" data-copy="submit" type="button">
              コピー
            </button>
          </article>
          <article>
            <span class="link-number">02</span>
            <div>
              <small>この端末へ保存</small>
              <strong>管理URL</strong>
            </div>
            <button class="button compact" data-copy="manage" type="button">
              コピー
            </button>
          </article>
          <article>
            <span class="link-number">03</span>
            <div>
              <small>OBSブラウザソースへ</small>
              <strong>表示URL</strong>
            </div>
            <button class="button compact accent" data-copy="overlay" type="button">
              コピー
            </button>
          </article>
        </div>
        <div class="manage-grid">
          <section class="inbox-panel">
            <header>
              <div>
                <span>INBOX</span>
                <strong id="letter-total">0通</strong>
              </div>
              <button class="text-button" id="refresh-button" type="button">
                更新
              </button>
            </header>
            <div class="manage-list" id="manage-list">
              <p class="empty-state">おたよりを待っています。</p>
            </div>
          </section>
          <aside class="preview-panel">
            <header>
              <span>OBS PREVIEW</span>
              <i></i>
            </header>
            <div class="preview-stage" id="preview-stage">
              <p>一通選ぶと、ここに表示されます。</p>
            </div>
            <div class="preview-actions">
              <button class="button compact" id="clear-button" type="button">
                表示を消す
              </button>
              <button class="button compact" id="toggle-button" type="button">
                受付を閉じる
              </button>
            </div>
          </aside>
        </div>
        <section class="danger-zone">
          <p>受付とおたよりは35日後に自動削除されます。</p>
          <button class="text-button danger" id="delete-button" type="button">
            今すぐすべて削除
          </button>
        </section>
        <p class="action-status" id="manage-message" aria-live="polite"></p>
      </section>
      <script src="/manage.js?v=1" type="module"></script>
    </Layout>
  );
}

export function OverlayPage({ sessionId }: { sessionId: string }) {
  return (
    <Layout
      canonical={`${product.url}/overlay/${sessionId}`}
      noindex
      title={`OBS表示 | ${product.name}`}
      bodyClass="overlay-page"
    >
      <section class="overlay-root" data-session-id={sessionId} id="overlay-app">
        <article class="overlay-letter" hidden id="overlay-letter">
          <span class="overlay-label">おたより</span>
          <p id="overlay-message"></p>
          <strong id="overlay-name"></strong>
        </article>
      </section>
      <script src="/overlay.js?v=1" type="module"></script>
    </Layout>
  );
}

export function GuidePage() {
  return (
    <Layout title={`使い方 | ${product.name}`}>
      <article class="guide-board">
        <header>
          <span class="eyebrow">THREE URLS</span>
          <h1>受付・管理・OBSを分ける。</h1>
          <p>配信ごとに作る三つのURLは、できることが違います。</p>
        </header>
        <ol class="guide-steps">
          <li>
            <span>01</span>
            <div class="guide-icon">〒</div>
            <h2>受付URLを配る</h2>
            <p>視聴者は名前と400字以内のおたよりを登録なしで送れます。</p>
          </li>
          <li>
            <span>02</span>
            <div class="guide-icon">✓</div>
            <h2>管理画面で選ぶ</h2>
            <p>届いた内容を確認し、今読む一通だけを選びます。</p>
          </li>
          <li>
            <span>03</span>
            <div class="guide-icon">▣</div>
            <h2>OBSに映す</h2>
            <p>表示URLをブラウザソースへ追加すると、選んだ内容だけが映ります。</p>
          </li>
        </ol>
        <section class="guide-note">
          <strong>管理URLと表示URLは公開しないでください</strong>
          <p>
            それぞれ別の秘密鍵をURLの末尾に含みます。管理URLは操作でき、表示URLは選択済みの一通しか読めません。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout title={`プライバシー | ${product.name}`}>
      <article class="prose">
        <header>
          <span class="eyebrow">PRIVACY</span>
          <h1>配信が終われば、残さない。</h1>
        </header>
        <section>
          <h2>保存するもの</h2>
          <p>
            番組名、募集文、任意の表示名、おたより本文、受付状態を保存します。アカウント、メールアドレス、IPアドレス、User-Agentは保存しません。
          </p>
        </section>
        <section>
          <h2>利用状況の計測</h2>
          <p>
            改善判断のため、ブラウザ内で生成したランダムな識別子と、作成・送信・選択などの操作種別を記録します。Cookieは使いません。本文は計測データに含めません。
          </p>
        </section>
        <section>
          <h2>削除</h2>
          <p>
            受付と本文は作成から35日後、利用状況の記録も35日後に削除します。管理画面から即時削除もできます。
          </p>
        </section>
        <section>
          <h2>URLの扱い</h2>
          <p>
            受付ページはURLを知る人が送信できます。管理鍵とOBS表示鍵はURLの#以降にあり、通常のHTTPリクエストやアクセスログへ送られません。
          </p>
        </section>
      </article>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout noindex title={`見つかりません | ${product.name}`}>
      <section class="not-found">
        <span>404</span>
        <h1>この受付は見つかりません。</h1>
        <p>URLが違うか、35日を過ぎて削除された可能性があります。</p>
        <a class="button compact" href="/">
          トップへ戻る
        </a>
      </section>
    </Layout>
  );
}
