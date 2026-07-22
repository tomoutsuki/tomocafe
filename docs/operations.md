# 設定・運用

## 必要環境

- Node.js `22.11.0`（`package.json` の engines）
- MongoDB（Atlas を想定）
- Discord Application と Bot Token
- モンスター画像を使う場合は公開 Cloudflare R2 base URL

```bash
npm ci
cp .env.example .env.development
npm run dev
```

`npm run dev` は Bot と完全な Express 管理画面を並行起動します。Bot だけは `npm run bot:dev`、管理画面だけは `npm run web:dev` です。

## 環境変数

環境選択ロジックは `src/config/environment.js` にあります。CLI の `--app-env=<name>`、`APP_ENV`、`NODE_ENV`、Heroku の `DYNO` の順で決まり、開発環境なら次の順で最初に存在するファイルを読みます。

```text
.env.development.local → .env.development → .env.dev.local → .env.dev → .env.local → .env
```

本番はファイルではなく Heroku Config Vars を前提にします。任意の環境名では `.env.<name>.local` → `.env.<name>` → `.env` の順です。`--env-file=<path>` / `ENV_FILE` は明示指定です。

| 変数 | 必須条件 | 説明 |
| --- | --- | --- |
| `APP_ENV` | 任意 | `development` / `production`。`dev` と `prod` は正規化される |
| `BOT_TOKEN` | Bot 起動時 | Discord Bot token |
| `CLIENT_ID` | コマンド登録時 | Discord application ID |
| `GUILD_ID` | guild scope の登録時 | Discord guild ID |
| `COMMAND_SCOPE` | 任意（`guild`） | `guild` または `global` |
| `REGISTER_COMMANDS` | 任意（`true`） | `false` なら slash command 登録をしない |
| `MONGO_URI` | Bot / Web / script | 主 MongoDB URI |
| `MONGO_DIRECT_URI` | 任意 | `mongodb+srv://` の SRV DNS 失敗時だけ使う標準 connection string |
| `R2_URL` | モンスター seed・画像同期 | R2 の base URL。末尾 `/` は正規化される |
| `WEB_PORT` | 任意（`3000`） | ローカル Web ポート。`PORT` が優先 |
| `BATTLE_TIMEOUT_MINUTES` | 任意（`30`） | 正の分数として解釈される戦闘期限 |

Mongo 接続は 10 秒の server selection timeout です。`MONGO_URI` が SRV URI で `querySrv` エラーになり、`MONGO_DIRECT_URI` が設定済みなら 1 回だけ後者へフォールバックします。

## 起動コマンド

| コマンド | 内容 |
| --- | --- |
| `npm start` | `bot.js` と `server.js` を通常起動 |
| `npm run dev` | 両方を `--app-env=development` で起動 |
| `npm run dev:combined` | 最小 health Web + Bot を 1 プロセスで開発起動 |
| `npm run prod:combined` | 上記を production として起動 |
| `npm run bot:dev` / `web:dev` | 片方だけを開発起動 |
| `npm test` | Node の組込み test runner を実行 |

`Procfile` は `node src/combined.js --app-env=production` を使います。完全な Web 管理画面ではない点に注意してください。

## シードと画像同期

環境を誤らないことが最重要です。`--app-env` と URI が意図する DB（開発は通常 `dev`、本番は通常 `main`）を実行前に確認してください。

| コマンド | 処理 |
| --- | --- |
| `npm run monsters:seed:dev` / `:prod` | `src/data/monsters.json` の 20 体を `monster_id` で upsert。R2 default URL を設定 |
| `npm run battle-items:seed:dev` / `:prod` | `src/data/battleItems.json` を `item_id` で upsert |
| `npm run monsters:refresh-damage:dev` / `:prod` | R2 の通常／差分画像が未確認のモンスターを確認してフラグ更新 |

モンスター seed は「通常 14、ボス 6」「通常は mechanic 1、ボスは 3」を検証してから書込みます。アップロード済みの画像だけが `has_default_image` / `has_damage_diff` を true にします。

## 監視と障害対応

- 分離 Web の `/health` は `{ environment, status }` を返します。combined の `/health` は Bot 接続、uptime、memory、timestamp も返します。
- Bot は Mongo 接続 error、起動失敗、画像確認失敗、戦闘掃除失敗を console に出力します。ホスティング側でこれを集約してください。
- `REGISTER_COMMANDS=false` は、Bot が未招待の開発 guild で接続だけ確認する用途です。機能検証前に本来の scope へ戻します。
- `R2_URL` がない場合、URL 生成とスタンプは省略され、既知モンスターの旧サムネイルにフォールバックします。

## 安全な変更・リリース

1. 対象モジュールの docs と `AGENTS.md` を読む。
2. 開発 DB で seed／migration を検証し、本番 URI では直接試さない。
3. `npm test` と変更対象の手動確認を実施する。
4. Bot と Web の両起動形態への影響を確認する。
5. 本番の管理 UI は認証された内部経路に限定する。
