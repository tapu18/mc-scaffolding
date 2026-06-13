# mc-scaffolding

Minecraft Bedrock の Script API アドオン開発環境を簡単に整えるための CLI ツールです。

空のディレクトリで `init` を実行すると、@minecraft/serverなどの依存関係のインストール、TypeScript のビルド設定、Minecraft の `development_behavior_packs` へ同期するための設定などを行います。

## Features

- `@minecraft/server` などの Script API 依存関係を対話式に選択
  - 実行時の最新バージョンを取得して候補に表示
  - beta APIのオン/オフやプレビュー版にも対応
- typescriptのビルドや公式debuggerの設定などの開発環境整備
- `behavior/` と `dist/scripts/` を Minecraft の `development_behavior_packs` へ同期
- watch モードで保存時に build + sync

## Usage

新しいアドオン用の空ディレクトリで実行します。

```bash
npx mc-scaffolding init
npm run build
npm run sync
npm run dev
```

## Generated Project

`init` は次のファイルを生成します。

```text
my-addon/
  src/ # 開発ディレクトリ
    main.ts
  behavior/ # scriptを除いたbehavior pack
    manifest.json
  .vscode/ # minecraft bedrock debuggerの設定
    launch.json
    tasks.json
  .gitignore
  package.json
  scaffolding.config.json # mc-scaffoldingの設定ファイル
  tsconfig.json
```

`src/` には Script API の TypeScript を置きます。`behavior/` は Behavior Pack の静的ファイル置き場です。`behavior/manifest.json` は `init` 時に自動生成されます。

ビルド後の生成物は `dist/` に出力されます。

```text
dist/
  scripts/
    main.js
  debug/
    main.js.map
```

`dist/debug` は VS Code デバッグ用の sourcemap 置き場で、Minecraft への同期対象には含めません。

## Configuration

プロジェクト設定は `scaffolding.config.json` に保存されます。

```json
{
  "name": "my-addon",
  "description": "My Bedrock Script API addon",
  "entry": "src/main.ts",
  "minecraft": {
    "edition": "bedrock",
    "packName": "my-addon",
    "path": "C:/path/to/development_behavior_packs"
  },
  "build": {
    "behaviorDir": "behavior",
    "minify": false,
    "sourcemap": true
  }
}
```

## Commands

### `mc-scaffolding init`

カレントディレクトリに Script API アドオン開発環境を生成します。

対話形式で次の内容を設定します。

- pack name
- description
- Minecraft Bedrock / Minecraft Preview
- `development_behavior_packs` path
- beta Script API module の利用可否
- `@minecraft/server` version
- 追加の `@minecraft/*` module
- `min_engine_version`

カレントディレクトリにあるファイルと競合し、既存ファイルを上書きする可能性がある場合は、生成前にエラーで止まります。

### `mc-scaffolding build / npm run build`

`scaffolding.config.json` を読み込み、`src/main.ts` を `dist/scripts/main.js` にバンドルします。

```bash
mc-scaffolding build
mc-scaffolding build --sync
mc-scaffolding build --sync --dry-run
```

`--sync` を付けると、ビルド後に Minecraft の `development_behavior_packs` へ同期します。`--dry-run` を付けると、同期内容だけを表示して書き込みません。

### `mc-scaffolding sync / npm run sync`

再ビルドせず、現在の `dist/scripts` と `behavior/` を Minecraft の `development_behavior_packs` へ同期します。

```bash
mc-scaffolding sync
mc-scaffolding sync --dry-run
mc-scaffolding sync --force
```

同期先 pack ディレクトリには `.mc-scaffolding.json` を置きます。既存ディレクトリにこのファイルががない場合や、別プロジェクトのファイルがある場合は、既定では上書きしません。

既存ディレクトリをこのプロジェクトの管理対象として取り込む場合だけ `--force` を使います。`--force` は同期先 pack ディレクトリの中身を置き換えるため、事前に `--dry-run` で確認してください。

### `mc-scaffolding dev / npm run dev`

起動時に一度 build + sync を実行し、その後ファイル変更を監視します。

```bash
mc-scaffolding dev
mc-scaffolding dev --force
```

監視対象は `src/`、`behavior/`、`scaffolding.config.json` です。ビルドエラーが発生しても watch は継続し、次の保存時に再試行します。

### `mc-scaffolding config`

ユーザー単位の default path を管理します。設定ファイルは通常 `~/.config/mc-scaffolding/config.json` に保存されます。

```bash
mc-scaffolding config show
mc-scaffolding config set-path --edition bedrock --path "/path/to/development_behavior_packs"
mc-scaffolding config clear-path --edition bedrock
```

### `mc-scaffolding version`

CLI のバージョンを表示します。

```bash
mc-scaffolding version
mc-scaffolding --version
```

## Notes
- [minecraft公式のdebugger (VS code 拡張機能)](https://marketplace.visualstudio.com/items?itemName=mojang-studios.minecraft-debugger)
