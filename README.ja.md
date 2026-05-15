[English](README.md) | [日本語](README.ja.md)

# omp-mc (Maas Creative Distribution)

`omp-mc` は、自律型コーディングエージェント [`oh-my-pi`](https://github.com/can1357/oh-my-pi) に **「厳格なエンジニアリング規律」** を強制するための設定レイヤー・フォークです。

AIがコードを書く際の「サボり（テストを飛ばす、型をanyにする、仕様を無視する）」を物理的に不可能にし、BDD（振る舞い駆動開発）と機械的監査ループ（Mechanical Audit Loop）を強制するパイプラインを提供します。

## 核心となるコンセプト

1. **仕様定義の強制 (Gherkin Enforcer)**: エージェントはコードを書く前に、`.feature` ファイル（Gherkin）や OpenAPI 仕様書を定義しなければなりません。
2. **機械的監査 (Mechanical Audit)**: `npm run audit` が Exit Code 0 を返すまで、エージェントはタスクを完了したと報告できません。
3. **サボり禁止令 (Anti-Laziness)**: `any` 型の禁止、巨大な関数の制限、ハードコードされた秘密情報の検出を自動化。
4. **リモート操作 (omp-mc-remote)**: Tailscale 経由でスマホやタブレットから PWA として操作。外出先からの「ツール承認」や「進行監視」を快適にします。

---

## セットアップ手順

### Step 0: `oh-my-pi` のインストール
まだインストールしていない場合は、本体を導入してください。
```bash
curl -fsSL https://omp.sh/install | sh
```

### Step 1: このリポジトリをクローン
```bash
git clone https://github.com/maas-creative/omp-mc.git
cd omp-mc
```

### Step 2: モデルとリモートの設定
`models.env.example` を `models.env` にコピーし、使用するモデル（GPT-5.5等）や API キーを記述します。
```bash
cp models.env.example models.env
nano models.env
```
> [!IMPORTANT]
> `models.env` は `.gitignore` に登録されているため、APIキーを書き込んでも push されません。

### Step 3: インストーラーの実行
```bash
./install.sh
source ~/.zshrc
```
このスクリプトは以下の処理を自動で行います：
- 監査ツール（Cucumber, Depcruise, Spectral, Stryker）の不足分をグローバルインストール
- `~/.omp/rules` / `~/.omp/agent/agents` / `~/.omp/hooks` へのシンボリックリンク作成
- `omp-mc` / `omp-mc-remote` / `omc-init` コマンドの登録
- `remote-agent` への `omp-mc` プロバイダーの自動注入

---

## 利用可能なコマンド

### `omp-mc`
エージェントを起動します。`~/.omp/rules` にリンクされた厳格ルールが自動で適用されます。

### `omp-mc-remote`
リモートアクセスサーバーを起動します。
- ポート 44444 が既に使用されている場合、古いセッションを終了するか確認する機能付き。
- スマホのブラウザで表示されたURLを開けば、PWAとして利用可能です。

### `omc-init`
新しいプロジェクトで実行すると、`package.json` に `audit` スクリプトを一括追加します。

---

## 強制監査ループの仕組み

`.omp/rules/02-mechanical-audit.md` により、AIは以下のステップを「物理的な壁」として認識します：

1. **BDD**: `cucumber-js` による振る舞い検証
2. **Arch**: `depcruise` によるアーキテクチャ依存関係チェック
3. **API**: `spectral` による API 仕様整合性チェック
4. **Security**: `npm audit` による脆弱性スキャン

エージェントが「できました！」と言っても、これらのツールが 1 つでもエラーを吐けば、エージェントはタスクを継続し、修正し続けなければなりません。

## ライセンス
このフォークの追加設定分については MIT License ですが、ベースとなる `oh-my-pi` のライセンスに従ってください。
