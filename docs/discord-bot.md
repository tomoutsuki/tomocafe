# Discord Bot

## 入口とイベント

`src/bot.js` は Gateway intents（Guilds / GuildMessages / GuildMessageReactions / MessageContent / GuildMembers）で Discord に接続します。`src/functions/handlers` が `src/events/client` と `src/commands/*` を自動走査します。

| イベント | 実装 | 挙動 |
| --- | --- | --- |
| `clientReady` | `events/client/ready.js` | ログ出力 |
| `guildMemberAdd` | `events/client/guildMemberAdd.js` | 未登録の人へ初期豆・ウェルカムコーヒーを保存。DM は失敗しても登録を維持 |
| `messageCreate` | `bot.js` | `!` / `！` のメッセージ型コマンドを振り分け |
| `interactionCreate` | `events/client/interactionCreate.js` | スラッシュ、戦闘ボタン、ショップ購入ボタンを振り分け |

スラッシュコマンドは起動時に Discord REST API へ登録します。`COMMAND_SCOPE=guild`（既定）では `GUILD_ID`、`global` ではアプリ全体へ登録します。`REGISTER_COMMANDS=false` で登録を飛ばせます。

## プレイヤー向けコマンド

| 種別 | コマンド | 実装 | 内容 |
| --- | --- | --- | --- |
| メッセージ/スラッシュ | `!menu` / `！メニュー` / `/menu` | `helpers/menu.js`, `commands/tools/menu.js` | ランダムなドリンクとデザート |
| メッセージ/スラッシュ | `!wadai` / `！話題` / `/wadai` | wadai helpers/command | ランダムな話題 |
| メッセージ/スラッシュ | `!shinya` / `！深夜` / `/shinya` | shinya helpers/command | 深夜向け話題 |
| メッセージ/スラッシュ | `!ping` / `/ping` | inline / command | 疎通確認 |
| メッセージ/スラッシュ | `!daily` / `！日給` / `/daily` | daily helpers/command | 24 時間ごとの 10–20 豆 |
| メッセージ | `!balance` / `！残高` | `helpers/balance.js` | 豆残高 |
| メッセージ | `!inventory` / `！インベントリ` | `helpers/inventory.js` | Embed の所持品一覧 |
| スラッシュ | `/register` | `commands/tools/register.js` | 明示的な初回登録 |
| メッセージ | `！メモ追加 <本文>` | `helpers/memo.js` | 区切り文字で複数メモを追加 |
| メッセージ | `！メモ` | `helpers/memo.js` | メモをリアクション操作で閲覧・完了化 |
| メッセージ | `！メモ削除` | `helpers/memo.js` | リアクションで削除 |

注意: `!battle` は一般プレイヤー向けコマンドではなく、現状は管理者のテスト用です。また、メッセージ型とスラッシュ型で利用可能な機能には差があります。

## メモの操作規約

- 1 ページは最大 9 件。複数ページなら 👈 / 👉 で移動する。
- 数字リアクションで閲覧時は完了化、削除モードでは削除する。
- 操作できるのはメモ表示を開いた本人だけ。
- ❌ は表示を閉じる。5 分で受付終了し、リアクションを消す。
- `！メモ追加` は空白、全角空白、読点、カンマで複数タイトルを区切る。各タイトルは trim 後に MongoDB の 200 文字制約を満たす必要がある。

## 管理者コマンド

`config.ADMIN_ROLE_NAMES`（既定: `BOT管理者`、`このカフェの店長`、`バイト店員`）のいずれかを持つ Discord メンバーが対象です。

| コマンド | 引数 | 実装 | 内容 |
| --- | --- | --- | --- |
| `!citem` | ID、タイトル、説明、レアリティ、画像 URL、価格 | `helpers/admin/citem.js` | アイテムマスターを作成 |
| `!cshop` | アイテム ID または `all` | `helpers/admin/cshop.js` | 購入ボタン付きショップカードを送信 |
| `!gbeans` | ユーザーメンション、正の数量 | `helpers/admin/gbeans.js` | 豆を付与 |
| `!gitem` | ユーザーメンション、アイテム ID | `helpers/admin/gitem.js` | アイテムを 1 個付与 |
| `!guide` | なし | `helpers/admin/guide.js` | ガイド画像・文を連続送信 |
| `!battle` / `！戦闘` | なし | `helpers/battle.js` | エスプレッソ・スライムとのテスト戦闘を開始 |

## ショップ interaction

ショップカードのボタン ID は `buy@<item_id>@<price>@<amount>` です。`interactionCreate` は `game/shopManager.buyItem` へ渡します。これは既存プロトコルですが、価格を UI から受け取る現状は安全ではありません。新規実装は [ドメインルール](domain-rule.md) に従うサーバー側価格計算サービスへ移行してください。

## エラーと応答

- スラッシュコマンドは `interactionCreate` の try/catch で ephemeral な共通エラーを返します。
- 各 helper のエラー処理は一貫していません。ユーザー操作では Discord に失敗を返し、詳細を構造化ログに残すサービス境界へ統一するのが拡張方針です。
- メッセージ型コマンドは Discord の仕様上、通常の返信を ephemeral にできません。
