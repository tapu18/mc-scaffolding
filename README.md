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

要件整理は [docs/requirements.md](docs/requirements.md) にまとめています。
