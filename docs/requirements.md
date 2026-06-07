# mc-scaffolding Requirements

## 目的

Minecraft Bedrock の Script API を使ったアドオン開発を、できるだけ少ない手順で始められる CLI ツールを作る。

主な狙いは次の通り。

- `init` のようなコマンドで、`manifest.json`、npm、TypeScript の開発環境を自動生成する
- TypeScript のソースを 1 つの JavaScript ファイルにまとめる
- ファイル保存時、または明示的なコマンド実行時に、Minecraft Bedrock が読む開発用フォルダへアドオンを同期する
- Bedrock Script API 固有の面倒な設定や配置ルールを、プロジェクト側から隠蔽する

## 想定ユーザー

- Minecraft Bedrock の Script API でアドオンを作りたい開発者
- TypeScript で Script API を書きたいが、毎回 `manifest.json` やビルド設定を作るのが面倒な人
- 保存するたびに Minecraft の実フォルダへ手動コピーしたくない人

## MVP の対象範囲

最初のバージョンでは、Behavior Pack + Script API 開発に絞る。

- TypeScript プロジェクトの初期化
- Script API 用 `manifest.json` の生成
- `src/main.ts` から `scripts/main.js` へのバンドル
- Minecraft Bedrock または Minecraft Preview の `development_behavior_packs` へのコピー
- watch モードでの自動ビルドと同期

Resource Pack、複数パック構成、`.mcaddon` 出力、Marketplace 向け検証などは後続候補とする。

## CLI コマンド案

### `mc-scaffolding init`

新規アドオン開発環境を作成する。

MVP では対話式を基本とする。

MVP では空ディレクトリでの実行を前提とする。

`@minecraft/server` は、デフォルトでは安定版の最新を解決して使う。必要に応じて、`init` の対話中に別バージョンを選べるようにする。

`min_engine_version` は Mojang の `bedrock-samples` の最新 `behavior_pack/manifest.json` から取得した値をデフォルトにする。取得に失敗した場合は、ツール内の fallback 値を使う。値は `init` 時に `behavior/manifest.json` へ出力し、build 時にネットワークアクセスはしない。

対話で聞く項目:

- pack name
- description
- 同期先 edition
- beta Script API module の利用可否
- `@minecraft/server` version
- 追加の Script API module dependency
- `min_engine_version`

author は MVP では聞かない。

追加の Script API module dependency は、候補一覧から複数選択できる形式にする。`@minecraft/server` は必須として自動追加し、追加モジュールだけを任意選択にする。

追加モジュールの候補は、既知の Script API manifest module 候補をツール内に持ち、npm registry で存在を確認できたものを表示する。beta API を許可しない場合は安定版 module だけを候補にし、beta API を許可する場合は beta-only module も候補に含める。

beta API を許可した場合の npm package version は、通常版 Minecraft Bedrock では `*-stable` suffix を含む beta package version を優先する。Minecraft Preview では npm の `beta` dist-tag を優先する。

`manifest.json` の module dependency version には npm package version をそのまま書かず、`1.0.0-beta.1.26.21-stable` のような package version から `1.0.0-beta` のような manifest 用 module version に正規化して書く。

生成候補:

- `package.json`
- `tsconfig.json`
- `src/main.ts`
- `behavior/`
- `.vscode/launch.json`
- `.vscode/tasks.json`
- `scaffolding.config.ts`
- `.gitignore`

初期依存候補:

- `mc-scaffolding`
- `typescript`
- `@minecraft/server`
- 選択した追加 `@minecraft/*` module

`init` 後は `npm install` まで自動実行する。

### `mc-scaffolding build`

TypeScript をビルドし、Behavior Pack として配置できる成果物を作る。

`behavior/` は Behavior Pack の静的入力ディレクトリとして扱い、build 時には `dist/` へコピーしない。

`behavior/manifest.json` は `init` 時に生成し、build 時には再生成しない。以降は `behavior/` 配下の他のファイルと同じく、ユーザーが編集した内容を同期時に Minecraft の開発用 Behavior Pack フォルダへコピーする。

debug 用 sourcemap が有効な場合、生成 JavaScript は `dist/scripts/`、sourcemap は `dist/debug/` に分けて出力する。

MVP では、ビルド後に Minecraft Bedrock の開発用 Behavior Pack フォルダへの同期まで実行する。

同期しないビルドが必要な場合は `--no-sync` を使う。

想定出力:

```text
dist/
  scripts/
    main.js
  debug/
    main.js.map
```

### `mc-scaffolding sync`

`behavior/` の静的ファイルと `dist/` の生成済み script/debug を Minecraft Bedrock の開発用 Behavior Pack フォルダへコピーする。

`build` は同期まで含むため、`sync` は「再ビルドせずに現在の `dist` を同期したい」場合の補助コマンドとする。

### `mc-scaffolding dev`

ファイル変更を監視し、変更時に `build` 相当の処理を実行する。MVP では `build` が同期まで含むため、`dev` も変更のたびにビルドと同期を行う。

起動時には一度 build/sync を実行してから watch に入る。build error が発生しても watch は継続し、次の保存時に再試行する。

監視候補:

- `src/**/*.ts`
- `scaffolding.config.ts`
- `behavior/**/*`

### `mc-scaffolding config`

ユーザー単位のデフォルト設定を管理する。

設定ファイル:

```text
~/.config/mc-scaffolding/config.json
```

コマンド:

```bash
mc-scaffolding config set-path --edition bedrock --path "/path/to/development_behavior_packs"
mc-scaffolding config set-path --edition preview --path "/path/to/preview/development_behavior_packs"
mc-scaffolding config clear-path --edition bedrock
mc-scaffolding config show
```

Minecraft 同期先の解決順:

1. `scaffolding.config.ts` の `minecraft.path`
2. ユーザー設定の edition 別 default path
3. Windows の edition 別既定パス

Windows の既定パス:

```text
%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs
%APPDATA%\Minecraft Bedrock Preview\Users\Shared\games\com.mojang\development_behavior_packs
```

`init` 時もユーザー設定と Windows 既定パスを同期先候補として表示し、候補が1件の場合は入力欄の default として表示する。

## 設定ファイル案

```ts
export default {
  name: "my-addon",
  description: "My Bedrock Script API addon",
  entry: "src/main.ts",
  minecraft: {
    edition: "bedrock",
    packName: "my-addon",
    path: undefined,
  },
  build: {
    behaviorDir: "behavior",
    minify: false,
    sourcemap: true,
  },
};
```

`scaffolding.config.ts` は `manifest.json` の fields を持たない。`manifest.json` は `init` 時に `behavior/manifest.json` として生成し、その後は `behavior/` 配下の通常ファイルとして扱う。

## プロジェクト構成案

```text
my-addon/
  src/
    main.ts
  behavior/
    manifest.json
    functions/
    entities/
  package.json
  tsconfig.json
  .vscode/
    launch.json
    tasks.json
  scaffolding.config.ts
```

`behavior/` はユーザーが管理する Behavior Pack の静的ファイル置き場とする。`behavior/manifest.json` は `init` 時に対話入力を元に生成し、その後はユーザーが直接編集できる入力ファイルとして扱う。build 時には `behavior/` 全体を `dist/` へコピーせず、同期時に Minecraft の開発用 Behavior Pack フォルダへ直接コピーする。

ビルド後:

```text
my-addon/
  dist/
    scripts/
      main.js
    debug/
      main.js.map
```

`dist` は Minecraft フォルダそのものではなく、生成済み script/debug を置く作業用出力先とする。通常の開発では、`behavior/` と `dist/` の内容を Minecraft の `development_behavior_packs` へ mirror sync する。

同期後:

```text
com.mojang/
  development_behavior_packs/
    my-addon/
      manifest.json
      scripts/
        main.js
```

## 設計上の前提

- 実装言語は Node.js + TypeScript を第一候補とする
- バンドルには `esbuild` を第一候補とする
- watch には `chokidar` を第一候補とする
- 初期段階では Behavior Pack に集中し、Resource Pack は明示的に後回しにする
- 対応 OS は Windows と Linux を MVP 対象にする
- Minecraft Preview は、通常版と同期先パスが違う対象として MVP から対応する
- `init` は対話式を基本にする
- 同期先は Windows の既定パスをデフォルトとして使い、必要なら設定ファイルで明示できるようにする
- ユーザー単位の default path を `mc-scaffolding config set-path` で設定できる
- 同期先は `scaffolding.config.ts` の `minecraft.path`、ユーザー設定、Windows の edition 別既定パスの順で解決する
- `init` の同期先入力では、ユーザー設定の default path を入力欄の default として表示する
- `manifest.json` の UUID は `init` 時に自動生成する
- `@minecraft/server` は安定版の最新をデフォルトで解決し、必要なら `init` で選択できるようにする
- `@minecraft/server` の安定版最新は npm registry から取得する
- `@minecraft/server` の選択候補は、新しい安定版を数件と最新ベータを表示する
- `manifest.json` の `min_engine_version` は必ず出力する
- `min_engine_version` は `init` 時に Mojang `bedrock-samples` の raw manifest から取得し、失敗時は fallback 値を使う
- `min_engine_version` は `behavior/manifest.json` に出力し、build 時にはネットワークアクセスしない
- `manifest.json` は `init` 時に設定と対話入力から自動生成し、その後はユーザーが直接管理できるようにする
- 自動生成された `behavior/manifest.json` は、次回 build 時に上書きしない
- sync は `behavior/manifest.json` を特別扱いせず、`behavior/` 配下の他のファイルと同じように Minecraft の開発用 Behavior Pack フォルダへコピーする
- Script API 用の `manifest.json` module dependency は `init` 時だけツール側で自動生成する
- `@minecraft/server-ui` など、`@minecraft/server` 以外の module dependency も `init` で選べるようにする
- 追加 module dependency は候補一覧から複数選択できるようにする
- 追加 module dependency の候補はツール内の既知候補リストから選び、npm registry で存在を確認できたものを表示する
- beta Script API module の利用可否を `init` で聞く
- beta API を許可しない場合、追加 module dependency は安定版があるものだけを表示する
- beta API を許可する場合、beta-only module も候補に含める
- 通常版 Minecraft Bedrock で beta API を許可した場合、npm package version は `*-stable` suffix を含む beta version を優先する
- Minecraft Preview で beta API を許可した場合、npm package version は npm の `beta` dist-tag を優先する
- `manifest.json` の module dependency version は npm package version から manifest 用 module version に正規化し、beta API では `-beta` suffix を保持する
- `scaffolding.config.ts` は manifest 生値や Script API module dependency を持たない
- author は MVP の `init` では聞かない
- UUID 再生成コマンドは MVP では用意しない
- Script API の entry point はまず `scripts/main.js` 固定で始める
- ビルド出力は 1 つの JavaScript ファイルをデフォルトにする
- Behavior Pack の静的ファイルは `behavior/` をデフォルト入力ディレクトリとする
- `init` で VS Code Minecraft Bedrock Edition Debugger 向けの `.vscode/launch.json` と `preLaunchTask` 用 `.vscode/tasks.json` を生成する
- `launch.json` は Minecraft client から `/script debugger connect` する前提で `mode: "listen"` にする
- `launch.json` では `sourceMapRoot` を `${workspaceFolder}/dist/debug/`、`generatedSourceRoot` を `${workspaceFolder}/dist/scripts/` にする
- `dist/debug/main.js.map` には `file: "../scripts/main.js"` を出力し、生成 JS と sourcemap の対応を明示する
- `init` で生成する設定では sourcemap を有効にし、既存設定では sourcemap などの追加出力を設定で切り替え可能にする
- `init` では通常版と Preview のどちらを使うか必ずユーザーに選ばせる
- 通常版と Preview のどちらを選んだかは `scaffolding.config.ts` に保存する
- WSL や Linux launcher のパス自動検出は MVP では入れない
- `dev` の同期は mirror sync とし、削除されたファイルは同期先からも削除する
- mirror sync の削除対象除外は MVP では用意しない
- `build` はビルド後の同期まで含める
- 同期しないビルド用に `build --no-sync` を用意する
- `dist` は生成済み script/debug の作業用出力先として固定し、ユーザー設定では Minecraft 同期先だけを扱う
- `dev` は起動時に一度 build/sync してから watch に入る
- `dev` は build error 時も watch を継続し、次の保存で再試行する
- パッケージ名とコマンド名は `mc-scaffolding` とする
- 設定ファイル名は `scaffolding.config.ts` とする
- 同期先の既定パス候補がない場合は、`init` 中に手入力させる
- `init` 後は `npm install` まで自動実行する
- `init` は空ディレクトリでの実行を前提とし、既存プロジェクトへの追加は MVP では扱わない
- package manager は npm 固定とし、pnpm / yarn の選択は MVP では扱わない
- `init` 時に生成予定のファイルと同名のファイルが既に存在する場合は、上書きせずエラーで止める
- VS Code 向けの `.vscode/launch.json` と `.vscode/tasks.json` は MVP で生成する

## 未確定事項

### 対応 OS

Minecraft Bedrock の実フォルダパスは OS ごとに違う。

決定:

- MVP では Windows の Bedrock / Preview 既定パスをサポートする
- WSL や Linux launcher の同期先は `minecraft.path` または `mc-scaffolding config set-path` で明示する

決める必要があること:

- Linux ネイティブの Bedrock 環境をどこまで想定するか
- macOS、Android などを後続候補に入れるか

### Minecraft の対象環境

Script API は Minecraft のバージョンや module version に影響される。

決定:

- 通常版 Minecraft Bedrock と Minecraft Preview の両方を対象にする
- Preview は基本的に別の同期先パスとして扱う

決める必要があること:

- edition の値を `bedrock` / `preview` にするか、別の名前にするか

### `manifest.json` の生成方針

決定:

- `min_engine_version` は必須とする
- `min_engine_version` は `init` 時に Mojang `bedrock-samples` の raw manifest から取得した値をデフォルトにする
- `manifest.json` は `init` 時に対話入力から自動生成し、その後はユーザーが編集できる入力ファイルにする
- Script API 用の module dependency は `init` 時だけツール側で自動生成する

決める必要があること:

- 既知の Script API manifest module 候補リストをリリースごとにどう更新するか

### 同期先の決定方法

決定:

- 同期先は明示設定を優先し、明示設定がなければ Windows の既定パスを使う
- Windows の Bedrock / Preview 既定パスを候補にする
- WSL や Linux launcher のような特殊環境では、`scaffolding.config.ts` かユーザー設定で明示できるようにする
- 既定パス候補がない場合は、`init` 中に同期先パスを手入力させる

決める必要があること:

- init 中に入力したパスを、ユーザー設定へ保存する導線を用意するか

### バンドルの仕様

決定:

- デフォルトでは 1 つの JavaScript ファイルを出力する
- sourcemap などは設定で変更可能にする

決める必要があること:

- 出力ファイル名を `scripts/main.js` 固定にするか
- 複数 entry point を許可するか
- minify をデフォルトで有効にするか
- `@minecraft/server` を bundle から external 扱いにするか

### 開発体験

決定:

- `init` は対話式を基本にする
- package manager は npm 固定とする
- `init` 後は `npm install` まで自動実行する
- `init` 時に生成予定ファイルが既に存在する場合はエラーで止める
- VS Code 向け設定は MVP では生成しない

決める必要があること:

- CI や自動生成向けに非対話式オプションも用意するか
- ログは簡潔にするか、詳細表示オプションを用意するか

## 後続候補

- Resource Pack 生成
- Behavior Pack + Resource Pack のペア管理
- `.mcpack` / `.mcaddon` 出力
- world への自動適用補助
- manifest の検証
- Script API の型・バージョン選択
- サンプルテンプレートの追加
- GitHub Actions 用の build check
- 既存プロジェクトへの `init` 追加対応
- pnpm / yarn 対応
- VS Code 向け設定生成

## 名前

正式名は `mc-scaffolding` とする。

理由:

- Minecraft の足場ブロックの正式英名である `scaffolding` に由来する
- `init` で開発環境の足場を作るツールの性格と合う
- `mc-` prefix により、npm package 名として Minecraft 関連ツールであることが伝わる
- `allay` のような Minecraft 固有名詞だけを使うより、一般語としての意味もあり用途が伝わりやすい

npm package 名と CLI コマンド名は `mc-scaffolding` とする。

## 実装時の判断事項

細かい仕様は実装時に以下の方針で決める。

- ユーザーに追加質問せず、既存の決定事項に沿った保守的なデフォルトを置く
- 破壊的な上書きや削除が発生する可能性がある場合は、CLI 上で明示的に止める
- MVP の範囲を広げる判断は避け、後続候補に回す
