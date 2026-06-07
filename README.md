# mc-scaffolding

Minecraft Bedrock の Script API 開発環境をワンコマンドで整えるための CLI ツール構想です。

## Usage

```bash
npm install
npm run build
node dist/cli.js --help
```

アドオンプロジェクト側では、公開後に次のような使い方を想定しています。

```bash
npx mc-scaffolding init
npm run dev
```

生成プロジェクトでは、`src/` に Script API の TypeScript、`behavior/` に Behavior Pack の静的ファイルを置きます。ビルド時はそれらを組み合わせた `dist/` を Minecraft の `development_behavior_packs` へ同期します。

`init` は VS Code の Minecraft Bedrock Edition Debugger 用に `.vscode/launch.json` と `.vscode/tasks.json` も生成します。debug 用 sourcemap は `dist/debug/`、生成 JavaScript は `dist/scripts/` に分けて出力します。

Minecraft の同期先をユーザー単位で保存できます。

```bash
mc-scaffolding config set-path --edition bedrock --path "/path/to/development_behavior_packs"
mc-scaffolding config set-path --edition preview --path "/path/to/preview/development_behavior_packs"
mc-scaffolding config show
```

要件整理は [docs/requirements.md](docs/requirements.md) にまとめています。
