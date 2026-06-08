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
npm run build
npm run sync
npm run dev
```

生成プロジェクトでは、`src/` に Script API の TypeScript、`behavior/` に Behavior Pack の静的ファイルを置きます。ビルド時は生成済み script/debug を `dist/` に出力し、同期時に `behavior/` と `dist/scripts` を Minecraft の `development_behavior_packs` へコピーします。`dist/debug` は同期しません。

`build` はローカルの `dist/` 生成のみ行います。Minecraft へ反映する場合は `sync` を実行するか、`build --sync` を使います。`sync` は同期先に `.mc-scaffolding.json` を置き、既存の未管理フォルダは既定では上書きしません。既存フォルダをこのツールの管理対象として取り込む場合は `--force`、変更内容だけ確認したい場合は `--dry-run` を使います。npm scripts 経由で CLI オプションを渡す場合は `npm run sync -- --force` のように `--` を挟みます。

Windows で同期先 pack の個別ファイルを Minecraft や Explorer が使用中の場合、同期に失敗することがあります。その場合は Minecraft や pack フォルダを開いているアプリを閉じてから再実行してください。

`init` は VS Code の Minecraft Bedrock Edition Debugger 用に `.vscode/launch.json` と `.vscode/tasks.json` も生成します。debug 用 sourcemap は `dist/debug/`、生成 JavaScript は `dist/scripts/` に分けて出力します。

Minecraft の同期先をユーザー単位で保存できます。

```bash
mc-scaffolding config set-path --edition bedrock --path "/path/to/development_behavior_packs"
mc-scaffolding config set-path --edition preview --path "/path/to/preview/development_behavior_packs"
mc-scaffolding config show
```

要件整理は [docs/requirements.md](docs/requirements.md) にまとめています。
