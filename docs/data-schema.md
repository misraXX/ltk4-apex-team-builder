# データスキーマ

このファイルは、AI運用で機械回収するメタ情報や、運用上のデータ構造を定義するための文書です。

## codex-meta

`codex-meta` は、`docs/codex-report.md` の最新レポートに含める機械回収用メタ情報です。

ダッシュボード回収ツールは、各プロジェクトの `docs/codex-report.md` を読み取り、最新レポート内の `codex-meta` を優先して状態を集計します。

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

| 項目 | 型 | 必須 | 説明 |
|---|---:|---:|---|
| projectId | string | 必須 | プロジェクトID。初期生成では `ltk4-apex-team-builder` を使用する。 |
| status | string | 必須 | `not_started` / `in_progress` / `completed` / `blocked` / `failed` |
| humanCheckNeeded | boolean | 必須 | 人間確認が必要か |
| designUpdateNeeded | boolean | 必須 | 設計書更新が必要か |
| blocked | boolean | 必須 | 作業が停止中か |
| nextHumanAction | string | 必須 | 次に人間がやること |
| nextCodexAction | string | 必須 | 次にCodexへ依頼するとよいこと |

## status の定義

| 値 | 意味 |
|---|---|
| not_started | 未着手 |
| in_progress | 作業途中 |
| completed | 指示された作業が完了し、確認も実施済み |
| blocked | 人間判断や外部要因で停止中 |
| failed | 実装または検証に失敗 |

## 記録禁止情報

- APIキー
- Webhook URL
- トークン
- パスワード
- 個人情報
- 秘密情報

生成日: 2026-11-24

## アプリ設定データ v1

localStorageキー: ltk4-apex-team-builder:v1。JSON入出力も同じ構造。氏名・アイコンの変更は受け付けず既知の60人IDに紐付ける。

- version: 1
- eventName: 80文字以内の文字列
- members: 60人ID別。attending:boolean、rating:nullまたは1〜10整数、igl:yes/no/unknown、social:none/prefer/required、friends:本人以外の既知ID配列、note:500文字以内
- settings: sameTeam:boolean、repeat:boolean
- draft: nullまたはid/builtAt/teams(各2〜3人、重複なし)
- history: 最大2000件。id/confirmedAt/teams/scores。scoresは確定時のrating/igl/provisional

JSON読込は8MBまで。全体を検証してから確認付きで置換し、Undoに前状態を保持する。簡易パスワードは公開コード内SHA-256照合であり認証基盤ではない。

## アプリ設定データ v2（現在）

保存キー: ltk4-apex-team-builder:v2。v1キーを残し、移行を承認した場合だけv2へ書く。

- version:2。現在ratingはnullまたは1〜5整数。未評価の計算値は3。
- membersにorganization:string（80文字以内）を追加。旧設定からの初期値は空文字。
- settingsにpastTeamとsameOrganizationのbooleanを追加。既存sameTeamはLTK4、pastTeamはLTK1〜3。
- historyにratingScale:5/10を追加。v1履歴は10、現在評価のみceil(value/2)、新規確定履歴は5。過去scoresの値は変えない。
- 公開調査メタデータはsite/research.js（60人のrating/rankPeriod/confidence/evidence/organizationsEvidence/queries/researchStatus）。ローカル手動設定とは別で、確認付きで未評価・空組織だけ補完し指定2名の5を反映する。
- site/ltk-relations.jsは60人の各大会正規所属と675ペアの共通履歴。役割や階級、出典URL、取得時ハッシュと母集団件数を保持する。

RIDDLE ORDER/RIDDLEなどの表記は正規化し、個人・無所属・所属不明は共通組織関係にしない。組織の過去情報は現在条件へ採用しない。
