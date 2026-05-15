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

あなたはタスクを終了（resolve）しようとしていますが、**OSSを用いた機械的監査**を通過したという証拠が提示されていません。AIの主観による「正しく書けたと思います」というレビューは認められません。

## 必須プロセス
タスク完了前に、必ず以下の監査コマンド（またはプロジェクトに設定された `npm run audit`）を実行し、結果を確認してください。

1. **振る舞いの監査**: `cucumber-js` （Gherkin仕様が100% PASSすること）
2. **アーキテクチャの監査**: `depcruise src` （依存関係ルール違反がないこと）
3. **API仕様の監査**: `spectral lint openapi.yaml` （APIがある場合）
4. **テスト品質の監査**: `stryker run` （Mutation Testing。アサーション抜け等の無意味なテストを排除すること）
5. **脆弱性の監査**: `npm audit` （High以上の脆弱性が存在しないこと）

**Exit Code が 1 以上（エラーあり）の場合は、直ちにログを解読して修正し、Exit Code が 0 になるまで何度でも絶対に諦めずに再テストを繰り返してください。**
この監査をスキップして終了することは固く禁じられています。
