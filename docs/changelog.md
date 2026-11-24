# 変更履歴

## 2026-11-24

### 追加

- ltk4-apex-team-builder のAI運用土台ファイルを初期作成。
- `AGENTS.md`、`docs/design.md`、`docs/ai-development-rules.md`、`docs/codex-instruction.md`、`docs/data-schema.md`、`docs/codex-report.md`、`docs/progress-rules.md`、`docs/test-checklist.md`、`docs/agents/` を追加。
- 「Codex × ChatGPT 併用開発運用ルール v2」を初期ルールとして追加。
- `docs/codex-report.md` にダッシュボード回収用の `codex-meta` 付き最新レポート雛形を追加。

### 変更

- 初期生成のため、既存変更なし。

### 修正

- 初期生成のため、修正なし。

### 削除

- 初期生成のため、削除なし。

### 注意点

- 目的: LTK4参加者60人のAPEXカスタムを、出欠・手動10段階評価の合計点・IGL適性・個別の知り合い条件・当日の編成履歴を考慮して編成する。
- MVP範囲: ホストを使う人が60人の評価・IGL・関係性・出欠を編集し、自動編成、手動調整、マッチ確定、次マッチ編成を行える。合計点とIGL人数と条件の未達を確認できる。白系LTK4デザイン、人物アイコン、日本語UI、レスポンシブ。
- 今回やらないこと: APEX評価のネット自動収集、厳密な実力推定、共有DB、ログイン、課金、通知、Discord投稿、ゲーム連携、参加者への連絡。ゆふなさんへのURL送信自体は行わず依頼者に渡す。
