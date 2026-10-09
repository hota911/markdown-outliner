[English](README.md) | 日本語

# Markdown Outliner

Markdown のタスクリストをアウトラインとして編集するツールである。Obsidian プラグインとローカルで動く小さな Web アプリとして動作し、どちらも同じ編集処理を共有する。ファイルは普通の Markdown のままなので、Git や他のエディタ、コーディングエージェントと並行して同じファイルを編集できる。

画面は英語と日本語に対応している。Obsidian プラグインは Obsidian の表示言語に従い（Obsidian 1.8.7 以降。それより古い版では英語）、Web 版はブラウザの言語に従う。それ以外の言語では英語になる。

## 機能

- `- [ ]` / `- [/]` / `- [x]` のタスクと普通の箇条書きをアウトラインとして編集し、各項目の下にインデントしたノートを書ける。
- 編集していない項目の本文とノートでは、基本的なインライン Markdown を表示する。対象は `[text](url)` のリンク（http、https、mailto）、裸の http(s) URL、`**bold**`、`*italic*` / `_italic_`、`` `code` ``、`~~strikethrough~~` である。リンクは新しいタブで開き、本文のそれ以外の場所をクリックすると、クリックした文字の位置にカーソルを置いて元の Markdown を編集できる。
- 状態・タグ・本文の語句で絞り込める。絞り込み中もタスク、子項目、ノートを追加でき、新しいタスクには絞り込み中の状態とタグが付く。項目の本文とノートにある `#タグ` は、太字や斜体の中も含めてリンクのように表示される。クリックするとそのタグを絞り込みに追加する（編集中は ⌘ クリック、Windows と Linux では Ctrl クリック）。
- Tab / Shift+Tab で階層を変え、Alt+Up/Down かドラッグ＆ドロップで項目を移動する。兄弟の項目を複数選択して、まとめて移動・更新することもできる。
- 項目へのズーム、項目と埋め込みの折りたたみができ、今の表示（ファイル、絞り込み、ズーム）を好きな名前でブックマークできる。ブックマークのサイドバーはアウトラインをスクロールしても動かず、一覧が長いとサイドバーだけでスクロールする。
- 項目の本文の先頭か空白の後で `/` を入力すると、コマンドのメニューが開く。状態の変更、タスクと箇条書きの切り替え、ノートを開く、ズーム、項目をファイルにする、既存のファイルの埋め込みができる。`/` の後の文字で、コマンドを英語名か日本語名で絞り込む。Up/Down で選び、Enter、Tab かクリックで実行すると `/` 以降の文字は消える。Escape はメニューを閉じて文字を残す。単語の途中の `/`（`A/B` や URL）、全角の `／`、IME で入力した `/`、ノートではメニューは開かない。「既存のファイルを埋め込む」では、ほかの Markdown ファイルが一覧に出るので選ぶ。項目が空ならその項目が埋め込みになり、そうでなければ項目の下に埋め込みを追加する。Undo 1 回で `/` の文字を含む元の項目に戻る。
- 同じように `#` を入力すると、使用中のタグを選べる。Obsidian では Vault 全体のタグ（Obsidian のメタデータキャッシュから取得し、frontmatter のタグも含む）と、アウトライナーが読み込んだファイルのタグが一覧に出る。Web 版では、開いてからアウトライナーが読み込んだファイル（表示したファイルとその埋め込み）の `#タグ` が一覧に出る。フォルダー内のすべてのファイルではない。`#` の後の文字でタグを絞り込み、大文字と小文字、カタカナとひらがな、全角と半角の違いは区別しない。その文字で始まるタグが先に並ぶ。Enter、Tab かクリックで `#文字` をタグと空白に置き換える。一致するタグがなければメニューは閉じるので、新しいタグはそのまま入力すればよい。
- `- ![[work.md]]` のような項目単位の埋め込みはその場で編集でき、埋め込み先のファイルに保存される。埋め込みは、埋め込み元のファイルがあるフォルダーからの相対パスで解決する。
- 埋め込みのヘッダーから埋め込み先のファイル名を変更できる。Web 版が更新するのはその埋め込みの行だけで、ファイルへのほかのリンクは更新しない。Obsidian では Obsidian の設定に従ってリンクを更新する。
- Undo / Redo、最後の編集から約 0.8 秒後の自動保存、競合の処理に対応する。編集中にディスク上のファイルが変わった場合、別々の行への変更は自動で取り込む（このとき Undo の履歴は消える）。両方が同じ行を変更した場合は入力内容を残し、違いのある行を表示して、そこにどちらを使うか選べるようにする。
- 外部の変更は数秒ごとに取り込む。入力欄にフォーカスがある間は、変更が待っていることを状態表示で知らせ、入力欄を離れるか、タブやウィンドウに戻ったときに反映する。カーソルは同じ項目に残る。

見出し、コードブロック、その他のリスト以外の内容は保持するが、表示はしない。

## Obsidian へのインストール

### BRAT を使う

1. コミュニティプラグイン「BRAT」（Obsidian42 - BRAT）をインストールして有効にする。
2. BRAT の設定で "Add beta plugin" を選び、`hota911/markdown-outliner` を入力する。
3. 設定 > コミュニティプラグインで「Markdown Outliner」を有効にする。

### 手動で入れる

1. 最新の [GitHub Release](https://github.com/hota911/markdown-outliner/releases) から `main.js`、`manifest.json`、`styles.css` をダウンロードする。
2. それらを `<vault>/.obsidian/plugins/markdown-outliner/` に置く。
3. Obsidian を再読み込みし、設定 > コミュニティプラグインで「Markdown Outliner」を有効にする。

アウトライナーはリボンのアイコンか、コマンド「アウトライナーを開く」（英語では "Open outliner"）で開く。プラグインは Vault 内のどの `.md` ファイルでも編集でき、最後に表示したファイル、なければ Vault の最初の Markdown ファイルを開く。未保存の入力はプラグインが有効な間はメモリに保持されるので、Obsidian を終了する前やプラグインを無効にする前に保存すること。プラグインはデスクトップで使われてきた。スマートフォンについては[タッチスクリーン](#タッチスクリーン)を参照。

実験的機能：1 つのファイルを、専用のタブでアウトラインとして開くこともできる。`.md` ファイルのメニューから「アウトラインで開く」（"Open as outline"）を選ぶか、同じ名前のコマンドを実行すると、アクティブな Markdown エディタがアウトラインに切り替わる。タブ自身のメニューからはそのタブを切り替え、ファイルエクスプローラーやリンクのメニューからは新しいタブで開く。タブのタイトルはファイル名で、戻る・進むの移動に対応し、Obsidian を再起動しても復元される。タブのメニューの「Markdown で開く」で通常のエディタに戻る。ツールバーのファイル選択には引き続き Vault 全体が並ぶので、同じタブで別のファイルを表示することもできる。

## タッチスクリーン

主なポインターが指であるデバイス（CSS の `pointer: coarse`。スマートフォンや Obsidian モバイルなど）では、項目の本文かノートの編集中に、アウトライナーの下部にバーが表示される。ソフトウェアキーボードには Tab、Alt、Shift+Enter がないため、バーには次のコマンドがある：字下げを戻す（Shift+Tab）、字下げ（Tab）、上下への移動（Alt+Up/Down）、タスクの状態の切り替え、本文とノートの切り替え（Shift+Enter）、元に戻す、やり直す。ボタンはフォーカスを奪わないので、キーボードは開いたままになる。状態のボタンは項目の状態アイコンと同じく未着手、進行中、完了を順に切り替える。完了にするだけの Cmd+Enter とは異なる。

タッチスクリーンでのその他の違い：

- 項目のボタン（子項目の追加、ズーム、ファイルにする）は、指の下の項目ではなく、編集中の項目の下に表示される。ノートと移動のボタンは代わりにバーにある。
- ⠿ のハンドルをタップすると項目を選択する。タッチでのドラッグには対応していない。バーの移動ボタンを使うか、項目を選択して選択用のバーを使う。
- `/` のコマンドメニューはコマンドのタップで使える。行の高さは 36px である。
- ボタンの高さは 36px 以上になり、キーボードショートカットのヘルプは表示しない。幅 600px 以下の画面では、ブックマークをアウトラインの上に画面の高さの 40% までで表示し、それより長い一覧はその中でスクロールする。

タッチ用のレイアウトは、Pixel 7 をエミュレートした Chromium でテストしている（`e2e/mobile.spec.ts`）。実機の Android や iOS、Obsidian モバイルアプリでは確認していない。

## エージェントスキル

このリポジトリには Agent Skills 形式のスキル [`skills/markdown-outliner/`](skills/markdown-outliner/SKILL.md) が含まれている。Claude Code、Codex、Cursor、Gemini CLI などのコーディングエージェントにこのファイルの構造を伝え、編集しても項目、階層、状態、ノート、タグ、埋め込みが崩れないようにする。[`skills`](https://github.com/vercel-labs/skills) CLI でインストールする：

```sh
npx skills add hota911/markdown-outliner
```

または、`skills/markdown-outliner/` フォルダーをエージェントのスキル用フォルダー（Claude Code なら `~/.claude/skills/`、プロジェクトなら `.agents/skills/` など）にコピーする。スキルに載せた例は、`test/skill.test.mjs` がアウトライナーの解析処理と編集操作で確認している。

## Web 版

Node.js 24 以降が必要である。

```sh
npm ci
npm run build:web
node server.mjs [folder-or-file] [port]
```

その後 `http://127.0.0.1:<port>/` を開く（既定のポートは 4317）。引数なしでは、同梱の `samples/` フォルダーをその場で編集するので、元のファイルを残したい場合は先にコピーしておく。`.md` ファイルを 1 つだけ渡すと、サーバーはそのファイルだけを扱う。フォルダーを渡した場合、ページは最後に表示したファイル、なければフォルダーの最初の Markdown ファイルを開く。サーバーは 127.0.0.1 だけで待ち受け、ビルド済みのアプリを `dist/web/` から配信する。ブックマークと最後に表示したファイルはブラウザのローカルストレージに保存される。`npm start` は Web アプリをビルドし、既定の設定でサーバーを起動する。

## デスクトップアプリ（実験的）

実験的機能：デスクトップアプリはサポート対象外であり、どのバージョンでも変更・削除されうる。リリースには含まれず、Web 版と Obsidian プラグインはこれに依存しない。

[Tauri 2](https://v2.tauri.app/) で作った macOS アプリである。同じ UI をシステムの Web ビューで表示し、`server.mjs` のファイルアクセスを Rust に移植している（`src-tauri/`）。プロトタイプであり、PR #26 の Swift アプリの代替案である。Rust と Tauri CLI（`cargo install tauri-cli --version "^2"`）、macOS では Xcode Command Line Tools が必要である。

```sh
npm ci
npm run build:tauri   # writes src-tauri/target/release/bundle/macos/Markdown Outliner.app
npm run tauri:dev     # runs the app with the Vite dev server and hot reload
npm run test:tauri    # the Rust tests (cargo test)
```

初回起動時にフォルダーを尋ねられ、File > Open Folder…（Cmd+O）で別のフォルダーに切り替えられる（メニューは英語のみ）。ウィンドウのタイトルはフォルダー名である。アプリはそのフォルダーの `.md` ファイルを `server.mjs` と同じチェックとエラーコードで編集する。シンボリックリンク経由も含めてフォルダーの外に出るパスは拒否し、2 MB を超えるファイルは開かず、読み込み後にファイルが変わっていれば保存を拒否する。この場合アウトライナーは Web 版と同じように変更を取り込む。最後に開いたフォルダーは `~/Library/Application Support/io.github.hota911.markdown-outliner/last-folder` に平文のパスとして記憶し、フォルダーごとのブックマークはその隣の `preferences/` に保存する。`OUTLINER_WORKSPACE` にフォルダーを設定すると、そのフォルダーを記憶せずに 1 回だけ開く。

ページから呼べるのは、アプリのファイルと設定に関する 6 つのコマンドだけである（`src-tauri/capabilities/main.json`）。一般的なファイルシステムやシェルへのアクセスはない。デバッグビルド（`npm run tauri:dev`、`cargo tauri build --debug`）は、UI 自動化なしでアプリを確認するために `OUTLINER_DEBUG_SCRIPT` と `OUTLINER_DEBUG_THEME` も読む。これらは `src-tauri/src/debug.rs` に説明がある。リリースビルドにはこのコードは含まれない。

制限：

- アプリはアドホック署名であり、公証（notarization）はしておらず、DMG もない。別の Mac にコピーすると、システム設定 > プライバシーとセキュリティで許可するまで macOS がブロックする。
- 開けるのはフォルダーだけで、`server.mjs` のファイル 1 つだけを扱うモードは移植していない。
- ビルドと実行は macOS でしか行っていない。Tauri 2 は Windows、Linux、iOS、Android 向けにもビルドできるが、それぞれに固有の準備（Android では Android NDK）が必要で、まだ試していない。

## 開発

UI は Svelte 5 と TypeScript で書かれ、Vite でビルドする。未着手の開発タスクは [TODO.md](TODO.md) にある。プルリクエストを作る前に実行・確認することは、コントリビューターとコーディングエージェント向けに [AGENTS.md](AGENTS.md) にまとめてある。

```sh
npm ci              # install the development tools
npm run dev         # Vite dev server with hot reload and the file API on http://127.0.0.1:5173/
npm run demo        # build the web app and serve a temporary copy of samples/ on a free port
npm run dev:plugin  # watch mode: rebuild the Obsidian plugin into $OBSIDIAN_VAULT/.obsidian/plugins/markdown-outliner/
npm run lint        # ESLint with eslint-plugin-obsidianmd and eslint-plugin-svelte
npm run typecheck   # svelte-check over src/, e2e/, obsidian-e2e/ and the Vite and Playwright configs
npm test            # run test:node and test:ui
npm run test:node   # core, row key, server and packaging tests with node --test
npm run test:ui     # screen tests (test/ui/) and Obsidian adapter tests with Vitest and jsdom
npm run test:e2e    # build the web app and the preview, then run the browser tests (e2e/) in Chromium with Playwright, on desktop and as a Pixel 7
npm run test:obsidian # macOS only: build the plugin, then test it inside the Obsidian desktop app (obsidian-e2e/)
npm run test:perf   # time editing operations on large files and check that time grows linearly with the file size
npm run build       # write dist/web/ and the plugin files dist/main.js, manifest.json, styles.css
npm run build:preview # write dist/preview/markdown-outliner-preview.html, the web app on the files of samples/ in one file
```

`npm run dev` は既定で `samples/` を編集する。別のものを編集するには、`OUTLINER_WORKSPACE` にフォルダーか Markdown ファイル 1 つを設定する。

`npm run demo` は `samples/` を新しい一時フォルダーにコピーし、そのコピーを `server.mjs` で配信するので、編集が `samples/` に届くことはない。フォルダーと URL を表示する。`npm run demo -- <フォルダーまたはファイル> [ポート]` とすると、別のフォルダーか Markdown ファイルをコピーし、指定したポートで配信する。

`npm run dev:plugin` は開発中のビルドを Obsidian に読み込ませる。`OBSIDIAN_VAULT` に Vault（`.obsidian/` があるフォルダー）のパスを設定する。未設定か、フォルダーが Vault でない場合、スクリプトはメッセージを出して終了する。ソースが変わるたびに `main.js` を再ビルドし、`manifest.json` と `styles.css` をその隣にコピーする。Obsidian は新しいファイルを自分では検知しない。コミュニティプラグイン [Hot Reload](https://github.com/pjeby/hot-reload) をインストールしてプラグインのフォルダーに空の `.hotreload` ファイルを置き、変更時に再読み込みされるようにするか、ビルドのたびに Obsidian のコミュニティプラグイン設定で Markdown Outliner をオフにしてからオンに戻す。

画面テストは、メモリ上のファイルアダプターを相手に、描画した DOM をキーボードとポインターのイベントで操作し、保存された Markdown を確認する。jsdom にはレイアウトもドラッグ＆ドロップもないため、ドラッグは Playwright でテストする。`e2e/` の各テストは一時フォルダーに Markdown ファイルを書き出し、そのフォルダーで `server.mjs` を起動し、Chromium でマウスでドラッグして、ディスク上のファイルを確認する。ブラウザが必要なため、これらのテストは `npm test` に含まれない。初回の実行前に `npx playwright install chromium` で Chromium をダウンロードしておく。

`npm run test:obsidian` は、ビルドしたプラグインを macOS の Obsidian デスクトップアプリの中でテストする。`/Applications/Obsidian.app`、または `OBSIDIAN_APP` に設定したアプリバンドルを使い、どちらもなければテストをスキップする。各テストは新しい一時プロファイル（`--user-data-dir`）と `samples/` からコピーした一時 Vault で別の Obsidian プロセスを起動し、終了後に両方を削除する。そのため、手元の Obsidian の設定や Vault、起動中の Obsidian を読むことも変えることもない。Playwright は DevTools プロトコルでウィンドウに接続する。テストでは次のことを確認する：プラグインがコンソールエラーなしで読み込まれること、リボンのアイコンとコマンドでアウトライナーとファイル単位のアウトライン表示が開くこと、編集・状態の変更・ドラッグ＆ドロップがファイルに保存されること、「Markdown で開く」で元に戻り、再起動後にアウトラインのタブが復元されること、文字の色がライトテーマとダークテーマに従うこと、長いブックマーク名がボタンの中で折り返し、ブックマークのサイドバーがアウトラインとは別にスクロールすること、Obsidian の言語が日本語のときに表示が日本語になること。Playwright で Obsidian のメニューをクリックできるよう、テスト用の Vault ではネイティブメニューをオフにしている。これらのテストは画面に Obsidian のウィンドウを開くため、CI、`npm test`、`npm run test:e2e` では実行しない。

CI は、プルリクエストと `main` への push で lint、typecheck、`npm test`、`npm run test:e2e`、`npm run build` を実行する。別のワークフロー（`.github/workflows/tauri.yml`）が、`src-tauri/` か `package.json` が変わったときだけ、デスクトップアプリの Rust テストを macOS で実行する。macOS のランナーと Tauri の初回ビルドには数分かかるため、これは必須のチェックではない。

### プルリクエストのプレビュー

`npm run build:preview` は、Web アプリをサーバーなしの 1 つの HTML ファイル `dist/preview/markdown-outliner-preview.html` としてビルドする。スクリプトとスタイルはページに埋め込む。`samples/` のファイルはビルド時に埋め込み、メモリ上に保持する（`src/preview/adapter.ts`）。そのため編集はできるが、再読み込みすると samples の内容に戻り、ブックマークは保存されない。サーバーは要らず、ディスク上のファイルをそのままブラウザで開けばよい。`e2e/preview.spec.ts` は `file://` で開き、ほかに何も読み込まないこと、編集を保存できること、再読み込みで元に戻ることを確認する。

プルリクエストごとに `.github/workflows/preview.yml` がこのファイルをビルドし、zip にせず実行の成果物（artifact）としてアップロードし、そのリンクを載せたコメントをプルリクエストに 1 つ投稿または更新する。リンクを開くには GitHub へのログインが要る。フォークからのプルリクエストにはコメントできるトークンがないため、リンクは実行のジョブサマリーにだけ載る。

ソースの構成：

- `src/core.ts`：Markdown の解析と編集操作。両方の版で共有する。
- `src/ui/`：アウトライナーの UI。両方の版で共有する。`controller.svelte.ts` が編集の状態と操作を持ち、`.svelte` ファイルがそれを描画し、`mount.ts` が要素にマウントする。
- `src/obsidian/`：Obsidian プラグインのエントリーポイント（`main.ts`）。
- `src/web/`：単体の Web ページ。
- `src/tauri/`：デスクトップアプリのページ。`adapter.ts` が Rust のコマンドを呼ぶ。
- `src/preview/`：プルリクエストのプレビューのページ。`adapter.ts` が `samples/` のファイルをメモリ上に保持する。
- `src-tauri/`：デスクトップアプリ。`src/workspace.rs` は `server.mjs` から移植したファイルアクセスとそのテスト、`src/lib.rs` はコマンド、フォルダー選択ダイアログ、メニュー、ウィンドウを持つ。
- `src/styles.css`：両方の版のスタイル。色とフォントは Obsidian のテーマ変数を使うので、プラグインは Obsidian のテーマに従う。`src/web/theme.css` は Web ページ用にこれらの変数を定義し、システムの設定に従うライトとダークの 2 組を持つ。
- `server.mjs`：ローカル Web サーバーとファイル API。開発サーバーにも組み込まれる。
- `skills/markdown-outliner/`：これらのファイルを編集するためのエージェントスキル。プラグインにも Web 版のビルドにも含まれない。
- `vite.config.ts`：プラグインのビルド（CommonJS の `main.js` 1 ファイル）。
- `vite.web.config.ts`：Web アプリのビルドと開発サーバー。
- `vite.tauri.config.ts`：デスクトップアプリのページのビルドと開発サーバー。
- `vite.preview.config.ts`：プルリクエストのプレビューのビルド。スクリプトとスタイルをページに埋め込む。
- `scripts/package-plugin.mjs`：プラグインをビルドし、`manifest.json` と `styles.css` を `dist/` にコピーする。
- `scripts/demo.mjs`：`npm run demo` のために `samples/` の一時コピーを配信する。
- `scripts/perf-compare.mjs`：CI でプルリクエストとベースの速さを比べる。[性能](#性能)を参照。
- `scripts/changelog-section.mjs`：`CHANGELOG.md` から 1 つのバージョンの節を出力する。リリースノートに使う。
- `.changie.yaml`、`.changes/`：Changie の設定、未リリースの変更履歴の断片（fragment）、CHANGELOG.md の生成元になるリリース済みの各バージョン。
- `e2e/`：Chromium での Playwright テスト（ドラッグ＆ドロップ、レイアウト、`mobile.spec.ts` のタッチスクリーン用レイアウト）。`playwright.config.ts` は `mobile.spec.ts` を Pixel 7 として、それ以外をデスクトップの Chrome として実行する。
- `obsidian-e2e/`：Obsidian デスクトップアプリでのプラグインの Playwright テスト。専用の `playwright.config.ts` を持つ。`fixtures.ts` は Obsidian を起動し、ファイルを開く、ID でコマンドを実行する、Vault のファイルを読む、といったヘルパーを持つ。

プラグインのビルドは Svelte と共有コードを `main.js` にまとめるので、リリースした `main.js` が必要とするのは `obsidian` だけである。

### 性能

`npm run test:perf` は、生成した 17,000 項目と 34,000 項目のアウトライン（`test/large-outline.ts`、約 1MB と 2MB）で 8 つの操作の時間を測る：ファイルを開く、タイトルに入力する、項目をインデント・移動する、アウトライナーの外での変更をマージする、コンフリクトを解決する、語・タグ・状態で絞り込む（`test/perf-operations.mjs`）。各操作はそれぞれ別の Node プロセスで実行し、各回の前にガベージコレクションを行い、2 回のウォームアップの後の 7 回の中央値をその操作の時間とする。2 倍の大きさのファイルで 3 倍以上の時間がかかった操作（線形の操作なら約 2 倍、2 乗に比例する操作なら 4 倍になる）や、大きい方のファイルで 1 秒を超えた操作があるとテストは失敗する。これらの確認は過去の結果に依存せず、CI でも実行する。実行には約 10 秒かかる。並行して走る他のテストが時間を乱さないよう、`npm test` には含めていない。

Performance ワークフロー（`.github/workflows/perf.yml`）は、プルリクエストと `main` への push で実行する。必須のチェックではない。

- プルリクエストでは、`scripts/perf-compare.mjs` がベースのコミットをプルリクエストの隣にチェックアウトし、大きい方のファイルで各操作を両方 6 回ずつ、同じランナーで交互に測る。共有ランナーの速さはジョブごとに変わり、その差は 1 つのジョブの中での変動よりずっと大きい。2026 年 10 月に同じコミット同士を比べたとき、比は 0.95〜1.07 に収まったが、同じコミットでもジョブによって 1.7 倍の時間がかかった。そのため、過去の実行結果ではなく、同じジョブで測ったベースと比べる。線は 2 本あり、スクリプト冒頭の `WARNING_RATIO` と `FAILING_RATIO` で決める：
  - 警告：プルリクエストの中央値がベースの 1.3 倍以上。
  - 失敗：2 倍以上。ジョブが失敗する。

  どちらも、Mann-Whitney の U 検定で差が有意（p が 0.05 を操作の数 8 で割った値より小さい）な場合だけ数える。1 回だけ遅かった実行で反応しないためである。各操作のベースとヘッドの中央値、その比、p をまとめた報告はジョブのサマリーに出る。警告か失敗のときは、プルリクエストにも同じ内容をコメントし、以後の push ではその 1 つのコメントを更新する。フォークからのプルリクエストではジョブのサマリーだけになる。`npm run test:perf` の確認も同じジョブで実行し、それだけでもジョブを失敗させる。

  手元で比べるには、ベースを別のフォルダーにチェックアウトして渡す：`git worktree add --detach ../base main` の後に `node scripts/perf-compare.mjs ../base`。スクリプトはベース側の `test/perf-operations.mjs` と `test/large-outline.ts` をこのチェックアウトのもので上書きするので、両方が同じベンチマークを実行する。
- `main` への push ごとに、両方の大きさでの時間を [github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark) で `gh-pages` ブランチの履歴に追加する。`dev/bench/data.js` がコミットごとに 1 件の記録を持ち、`dev/bench/index.html` が操作ごとのグラフを描く。GitHub Pages で `gh-pages` ブランチを公開すると、グラフは <https://hota911.github.io/markdown-outliner/dev/bench/> で見られる。操作が遅くなったコミットを探すには、そのグラフで段差を探す。点にマウスを重ねるとコミットが表示され、クリックすると GitHub でそのコミットが開く。直前のコミットの 2 倍以上の時間がかかったときは、ワークフローがそのコミットにコメントする。連続するコミットは別のランナーで実行されるため、失敗にはしない。

## 変更履歴

[CHANGELOG.md](CHANGELOG.md) は [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に従い、[Changie](https://changie.dev)（バージョンを固定した devDependency。`npx changie` で実行する）で生成する。CHANGELOG.md を直接編集しない。`npx changie merge` が `.changes/` から作る内容と異なると `npm test` が失敗する。

- 利用者に見える変更を含むプルリクエストは、`npx changie new` で `.changes/unreleased/` に fragment を追加する（種別は Added、Changed、Deprecated、Removed、Fixed、Security から選び、既存の項目と同じ書き方で 1 行に書く）。`npx changie new --kind Fixed --body "..." --interactive=false` とすれば対話なしで同じことができる。変更ごとに別のファイルになるので、並行するプルリクエストがコンフリクトしない。
- まだリリースしていないものの修正や変更は、Fixed や Changed の項目を足さず、`.changes/unreleased/` にあるその機能の fragment を直す。リリースノートには、前のリリースの利用者から見て変わることだけを書くためである。
- テスト、CI、リリースするファイルに影響しない依存関係の更新のように、開発だけに関わる変更には fragment は不要である。
- リリース済みのバージョンは `.changes/<version>.md` にある。リリースノートを直すには、そのファイルを編集して `npx changie merge` を実行する。`.changes/header.tpl.md` は各バージョンより上に置く文章である。

利用者に見える変更では、README.md と README.ja.md の両方を更新する。

## リリース

1. 最新の `main` から切ったブランチで `npm version <patch|minor|major> --no-git-tag-version` を実行する。これで `package.json` と `package-lock.json` が更新され、続いて `version` スクリプトが、バージョンを `manifest.json` と `versions.json` にコピーし（`minAppVersion` も）、`.changes/unreleased/` の fragment を今日の日付の `.changes/X.Y.Z.md` にまとめ（`changie batch`）、CHANGELOG.md を生成し直す（`changie merge`）。`package.json` のバージョンの項目が CHANGELOG.md になければ `npm test` が失敗する。
2. CHANGELOG.md の新しい節を確認する。直すときは `.changes/X.Y.Z.md` を編集して `npx changie merge` を実行する。
3. 削除された fragment も含めて変更をコミットし、PR を作って `main` にマージする。
4. 更新された `main` で、バージョンと同じ名前のタグを `v` を付けずに push する：`git tag 0.1.0 && git push origin 0.1.0`。

`Release` ワークフローは、タグがバージョンと一致することを確認し、lint、typecheck、テスト、ビルドを実行してビルドの来歴（build provenance）を証明したうえで、`main.js`、`manifest.json`、`styles.css` を添付した GitHub Release を公開する。リリースノートは CHANGELOG.md のそのタグの節である（`node scripts/changelog-section.mjs <version>` で出力できる）。その節がないか空なら、ワークフローは失敗する。

## ライセンス

[MIT](LICENSE)
