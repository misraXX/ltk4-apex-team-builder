# Codex作業レポート

このファイルは、Codexが作業後に更新する作業報告ファイルです。

ダッシュボード回収ツールは、各プロジェクトの `docs/codex-report.md` を読み取り、最新レポート内の `codex-meta` を優先して状態を集計します。

## cycle-report.md との役割分担

- `docs/cycle-report.md`: 1回の開発サイクルごとの役割別チェック結果、未実施、修正必須、残るリスク、人間確認を記録する。
- `docs/codex-report.md`: Codex作業終了時の要約、変更ファイル、実行コマンド、テスト結果、次に人間が確認することを記録する。

`docs/codex-report.md` には、役割別チェック表を重複して増やしません。

## 運用ルール

- Codexは作業完了後、このファイルの先頭付近に最新レポートを追記する。
- 最新レポートには必ず `codex-meta` を含める。
- `codex-meta` は機械回収用の固定形式として扱う。
- 人間向けの詳細報告は、`codex-meta` の下にMarkdownで記載する。
- 不明な項目は推測せず、`未確認` または適切な値で明記する。
- 秘密情報、APIキー、Webhook URL、トークン、個人情報は書かない。

---

## 最新レポート

```yaml
codex-meta:
  projectId: "ltk4-apex-team-builder"
  status: "not_started"
  humanCheckNeeded: true
  designUpdateNeeded: false
  blocked: false
  nextHumanAction: "初回生成内容を確認する"
  nextCodexAction: "最初の実装指示を待つ"
```

### 実施内容

初期生成時点の雛形です。Codex作業後、この欄を最新内容に更新してください。

### 作成・変更したファイル

- 未実施

### 設計書との整合性チェック結果

- 未確認

### 受け入れ条件の達成状況

- 未確認

### 実行した確認コマンド

- 未実行

### 確認結果

- 未確認

### セキュリティ確認結果

- 秘密情報の記載なし
- 外部通信なし
- 権限変更なし

### 既存機能への影響

- 未確認

### 未対応・保留事項

- 初回作業前

### エラー・懸念点

- なし

### 次にやるとよいこと

- ChatGPTで要件を整理し、v2ルールに従ってCodex実装指示書を作成する。

生成日: 2026-11-24

## 2026-11-24 初期準備・構成確認待ち

```yaml
codex-meta:
  projectId: "ltk4-apex-team-builder"
  status: "in_progress"
  humanCheckNeeded: true
  designUpdateNeeded: false
  blocked: true
  nextHumanAction: "Cloudflareで2人限定・同期編集する構成案を確認する"
  nextCodexAction: "構成の了承後に実装と検証を進める"
```

実施: AI運用テンプレ生成CLIをprofile指定で実行し、独立フォルダへコピー。既存名簿60人を構造として読み、GitHubとCloudflare公式資料を確認。profile・設計・タスク・役割別記録を作成した。本体コードは未作成。外部サービス・DB・認証・公開は未実施。

設計整合: 当初の静的単独案に対し2人同期と限定閲覧が追加されたため、変更案を具体化し実装前停止。テスト: CLI成功と名簿構造の確認のみ。本体テストは未実施。既存sources・アプリ・正本・サイトは変更していない。

## 2026-11-24 初版実装・GitHub Pages公開

```yaml
codex-meta:
  projectId: "ltk4-apex-team-builder"
  status: "completed"
  humanCheckNeeded: true
  designUpdateNeeded: false
  blocked: false
  nextHumanAction: "公開URLを開き、実際の評価・IGL・関係性・出欠を設定してゆふなさんへ渡す"
  nextCodexAction: "初回利用のフィードバックに沿って調整する"
```

成果物: https://misraxx.github.io/ltk4-apex-team-builder/

コード: https://github.com/misraXX/ltk4-apex-team-builder

公開コードコミット: fd7e7c2。Actions run: https://github.com/misraXX/ltk4-apex-team-builder/actions/runs/45374965110 （success）。

主な作成ファイル: site/index.html、styles.css、app.js、core.js、roster.js、人物画像60件、mark.svg、tests/core.test.cjs、tools/serve.cjs、tools/extract-roster.cjs、package.json、.github/workflows/pages.yml、README、運用ドキュメント。既存プロジェクトの本体・データ・sourcesは変更していない。

実装: 出欠/1〜10点/IGL/個人の知り合い条件、自動編成、2人チーム、単独/ペアを入れ替える探索、手動交換/Undo、確定とスナップショット履歴、再編成、ブラウザ保存、検証付きJSON入出力、HTML簡易パス。UIは既存の白系LTK4に合わせた。

設計整合: 本人の最新指示どおり回避可能なHTMLパスを採用し、Cloudflare/Firebase/外部DB/外部認証を使わない。保存/データ構造/公開範囲はdesign.mdへ記載。自動同期と厳密2人限定は実装しておらず、TASK-007/008として明示した。

実行: npm.cmd run check（合格）、npm.cmd test（16/16合格）、画像60件のPillow verify（合格）、ブラウザの実操作検証、GitHub Actionsによる構文/16テスト/Pages公開（success）、公開HTML/JS/CSS/名簿/画像のHEAD（200）。ブラウザの検証詳細はcycle-report.md。qa/public-desktop.jpg、qa/public-mobile.jpg、qa/roundtrip-settings.jsonをローカルに保存し、Git/公開対象には含めていない。

セキュリティ確認: 本人が認めた簡易ロックであり、暗号化や強固な認証は主張しない。入力した設定をサーバー・URLへ送信しない。JSONを全体検証してから確認付きで置換し、入力文字はエスケープする。公開物に検証用の主観評価や私的関係性、秘密の資格情報は含めていない。

未対応: 2人の自動同期、厳密な2人限定。未実施: 実スマートフォンでの操作・APEX本番の受け入れ。実際の評価/IGL/関係性の入力は運営者が行う。変更ファイルと役割別の結果はtask-board/cycle-reportを参照。

## 2026-11-24 v2：5段階・60人調査・関係性追加・注釈削除

```yaml
codex-meta:
  projectId: "ltk4-apex-team-builder"
  status: "completed"
  humanCheckNeeded: true
  designUpdateNeeded: false
  blocked: false
  nextHumanAction: "同じ公開URLで調査一覧を確認し、必要な仮評価を修正する。旧設定は画面の移行確認で扱う"
  nextCodexAction: "運営者の修正を反映し、次の要望に対応する"
```

公開URL: https://misraxx.github.io/ltk4-apex-team-builder/

主な変更: site/app.js、core.js、index.html、styles.css、research.js、ltk-relations.js、docs/public-research.json、tests/core.test.cjs、v2.test.cjs、research.test.cjs、tools/build_research.py、build_ltk_relations.py、publish.cjs、GitHub Actions、READMEと運用資料。人物画像・名簿は変更していない。

内容: 5段階化と指定2名5、60人検索と出典/時期/確度、24人仮評価/36人未評価、現組織39、明示IGL1。LTK1〜4所属と675ペア（過去1〜3は370）、組織/過去同チームの候補と編成優先、組織手動編集。未指定のキャッチコピー/注釈を削除。v2別キー、確認付き換算、過去10段階保持、手動値の非上書き補完。

検証: npm.cmd run check成功、npm.cmd test 38/38成功。追加独立レビューで範囲外LTKシーズンと所属不明同士の結合を修正。出典監査でSHAKAの本人Pred動画、MOTHER3卒業、RIDDLE表記を修正。未評価36人も追加検索し、別ゲーム・別人物の実績を除外。ブラウザで移行・旧履歴保持・組織/候補・実JSON・60人編成・手動保持・注釈削除・スマホ幅を確認。

公開: 323d9cfのartifact経由デプロイは2回失敗（テストは成功）。a6db423で検証CI＋gh-pagesソースへ切替。公開ブランチc54b992adcfb27cdd0fad6cc146aa9b3d7ccb6cbがbuilt、CI https://github.com/misraXX/ltk4-apex-team-builder/actions/runs/45380348059 はsuccess。公開URLと主要資産HTTP200、公開版で指定2名5/全60人/6選択肢/エラーなしを確認した。

設計整合: 最新要望を実装前に設計へ反映し、データ/保存形式の旧値を保持する確認付き移行とした。外部DB/Cloudflare/Firebaseは使わない。資料にある役割分担に従い調査3担当と独立レビュー/検証を実施した。公開前に許可したユーザー操作以外の設定をサーバーへ送信しない。公開QAでも既存ユーザーデータを上書きしていない。

未対応: 自動同期・厳密な2人限定は従来どおり未対応。未評価36人は調査済みだが確証不足で、仮3として編成される。24人も過去実績に基づく仮値で現在能力の確定ではない。人間確認: 実際の5段階の妥当性、IGL/関係性の補正、ゲーム本番/実スマホ。既存sources・BPアプリ・正本・他サイトは未変更。

## 2026-11-24 ランク版 公開前検証

```yaml
codex-meta:
  projectId: "ltk4-apex-team-builder"
  status: "in_progress"
  humanCheckNeeded: true
  designUpdateNeeded: false
  blocked: false
  nextHumanAction: "ランク・IGL・関係性を実運用に合わせて補正"
  nextCodexAction: "同URLへ公開し公開版を確認"
```

TASK-015/016内部10段階/移行完了。017点数表示公開は本人変更で保留、018〜020ランク表示へ置換。変更はsite/app/core/index/styles/research、8ランク画像、調査生成、tests、README/package/運用docs。設計末尾に実装前反映済み。ローカル設定は公開へ含めない。

46テスト・構文・別担当diffレビュー成功。旧実JSONの59人出欠/内部点/IGL/関係性/メモ/履歴を保持し、ランクは独立付与。ブラウザで編集・書出し/読込/再読込・59人20チーム・次マッチ確定・全画面点数非表示・PC/モバイル幅・コンソールエラーなしを確認。画像は公式EA記事の切り出し、元と座標/SHAを記録。

未対応: 自動同期/厳密アクセス制限。37人のランク不明・古い到達実績の補正、実ゲームと実機スマホは人間確認。公開完了とCI結果は次の追記を正とする。sources/既存アプリ/他サイトは未変更。
