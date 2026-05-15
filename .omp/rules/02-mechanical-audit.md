---
description: 機械的監査（Mechanical Audit）の絶対厳守
triggers:
  - "(?i)resolve"
  - "(?i)I have finished"
  - "(?i)task complete"
  - "finish"
  - "完了"
---

# 機械的監査の絶対厳守ルール（Global）

タスク完了前に、必ずリポジトリまたは対象プロジェクトのルートで `bun run audit` を実行してください。

`bun run audit` は `.omp/audit/last-run.json` に監査証跡を保存し、以下の機械監査を実行または対象外として記録します。

1. **振る舞いの監査**: `cucumber-js` （Gherkin仕様が100% PASSすること）
2. **アーキテクチャの監査**: `depcruise src` または `depcruise packages`
3. **API仕様の監査**: `spectral lint openapi.yaml` （APIがある場合）
4. **テスト品質の監査**: `stryker run` （Mutation Testing設定がある場合）
5. **脆弱性の監査**: `npm audit --audit-level=high`

**Exit Code が 1 以上の場合は修正して再実行。`.omp/audit/last-run.json` の `result` が `pass` になるまで終わらせない。**
