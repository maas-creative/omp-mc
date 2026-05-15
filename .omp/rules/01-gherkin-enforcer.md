---
description: 振る舞い仕様書（BDD/Gherkin）の強制
triggers:
  - "(?i)edit"
  - "(?i)write"
  - "(?i)create"
  - "(?i)implement"
  - "実装"
  - "作成"
  - "修正"
---

# BDD仕様書（Gherkin）の絶対要件

実装を行う前に、必ず以下の点を確認してください。
1. `features/` に実装対象の **`.feature` ファイル（Gherkin記法）** が存在するか。
2. 存在しない場合は絶対にコードの実装を始めてはいけません。
3. 先に Gherkin 記法（`Feature`, `Scenario`, `Given`, `When`, `Then`）の仕様書を作成してください。

このルールは絶対であり、「今回は簡単だから」という理由でスキップすることは許可されません。
