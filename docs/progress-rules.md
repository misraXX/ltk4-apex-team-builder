# 進捗管理ルール

このファイルは、AI運用における進捗管理、状態定義、更新ルールをまとめるためのものです。

## 各ファイルの役割

- `docs/task-board.md`: タスクID単位の作業管理に使う。複数指示、保留、確認待ち、未対応を見える化する。
- `docs/cycle-report.md`: 1回の開発サイクルごとの役割別チェック結果に使う。
- `docs/changelog.md`: 仕様、構成、テンプレート、CLI仕様、運用ルールの変更履歴を残す。
- `docs/codex-report.md`: Codex作業終了時の重要レポートや実行ログを時系列で蓄積する。

各ファイルの役割を混同しないでください。

## 更新タイミング

- 複数指示を受けたとき: `docs/task-board.md` に `TASK-001` 形式でタスクを分解する。
- 開発サイクルを進めたとき: `docs/cycle-report.md` に役割別チェック結果を記録する。
- 仕様、生成対象、テンプレート、運用ルールを変えたとき: `docs/changelog.md` に変更履歴を追記する。
- Codex作業が終わるとき: `docs/codex-report.md` に作業レポートを追記する。

## task-board 状態定義

| 状態 | 意味 |
|---|---|
| 未着手 | まだ対応していない |
| 対応中 | 作業中 |
| 完了 | 実装・確認まで完了 |
| 保留 | 今回は対応しない |
| 確認待ち | ユーザー判断が必要 |
| 未対応 | 対応できていない |
| 一部完了 | タスクの一部だけ完了し、残作業がある |

## 必須ルール

- 作業終了時に必ず `docs/codex-report.md` を追記する
- 最新レポートには必ず `codex-meta` を含める
- 既存ログは削除しない
- 実行したコマンドと結果を書く
- 作成・変更・削除したファイルを書く
- 設計書との整合性チェック結果を書く
- 人間確認が必要かを書く
- 設計書更新が必要かを書く
- ブロック要因があるかを書く
- 次に人間が確認することを書く
- 次にCodexへ依頼すると良いことを書く

## Codex作業レポートと codex-meta

各プロジェクトでは、Codex作業後に `docs/codex-report.md` を更新する。

最新レポートには、以下の `codex-meta` を含める。

```yaml
codex-meta:
  projectId: "ltk4-apex-team-builder"
  status: "completed"
  humanCheckNeeded: true
  designUpdateNeeded: false
  blocked: false
  nextHumanAction: "画面を確認する"
  nextCodexAction: "次の実装を依頼する"
```

ダッシュボード回収ツールは、まずこの `codex-meta` を優先して読み取る。
`codex-meta` がない場合はMarkdown本文から簡易抽出を試みる可能性があるが、安定運用のため必ず記載する。

項目定義は `docs/data-schema.md` を参照する。

## 禁止事項

- 未対応、保留、確認待ちの項目を完了扱いしない
- `docs/cycle-report.md` をAI同士の会話ログ置き場にしない
- `docs/codex-report.md` に役割別チェック表を重複して増やさない
- 変更履歴に残すべき構成変更を `docs/codex-report.md` だけで済ませない

## 必須フラグ

以下は必ず記載すること。

```yaml
codex-meta:
  projectId: "ltk4-apex-team-builder"
  status: "completed | in_progress | blocked | failed | not_started"
  humanCheckNeeded: true
  designUpdateNeeded: false
  blocked: false
  nextHumanAction: "次に人間が確認・判断すること"
  nextCodexAction: "次にCodexへ依頼するとよいこと"
```

## humanCheckNeeded: true にする例

- UIや画面確認が必要
- 仕様判断が必要
- ユーザーの好みや方針確認が必要
- 実装は終わったが、人間確認後に次へ進むべき場合

## designUpdateNeeded: true にする例

- 設計書にない仕様を追加した
- UI仕様を変更した
- データ構造を変更した
- 処理フローを変更した

## blocked: true にする例

- 設計書と矛盾している
- 仕様が不足している
- 必要なファイルや環境変数がない
- 人間判断なしでは進めない
