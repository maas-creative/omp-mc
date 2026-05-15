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

タスク完了前に、必ず以下の監査コマンドを実行してください。

1. **振る舞いの監査**: `cucumber-js` （Gherkin仕様が100% PASSすること）
2. **アーキテクチャの監査**: `depcruise src` （依存関係ルール違反がないこと）
3. **API仕様の監査**: `spectral lint openapi.yaml` （APIがある場合）
4. **テスト品質の監査**: `stryker run` （Mutation Testing）
5. **脆弱性の監査**: `npm audit` （High以上の脆弱性がないこと）

**Exit Code が 1 以上の場合は修正して再実行。Exit Code 0 になるまで終わらせない。**
