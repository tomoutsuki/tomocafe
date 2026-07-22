# アーキテクチャ

## 全体像

Node.js 22 / CommonJS の単一リポジトリです。Discord Bot、MongoDB、Express 管理画面、Cloudflare R2 上のモンスター画像で構成されます。MongoDB はゲームの永続状態の唯一の保存先です。

```text
Discord メッセージ / スラッシュコマンド / ボタン
                 │
                 ▼
 bot.js ── events/client/interactionCreate.js ── helpers / game
                 │                                  │
                 │                                  └─ services/battleController.js
                 ▼                                            │
            Mongoose models ◀──── services/battleService.js ──┘
                 │
                 ▼
              MongoDB

ブラウザ ── server.js (Express/EJS/static JS) ── Mongoose models ── MongoDB
R2 ── monsterImageService.js / battleView.js ── モンスター画像
```

## 実行形態

| 形態 | 起動点 | 用途 | 公開機能 |
| --- | --- | --- | --- |
| 分離起動 | `src/bot.js` と `src/server.js` | ローカル開発、`npm run dev` | Bot と完全な管理画面 |
| 統合起動 | `src/combined.js` | `Procfile` の Heroku 起動 | Bot と `/`・`/health` の最小 HTTP 応答のみ |

`combined.js` は `bot.js` と一部のメッセージコマンド実装を重複して持ち、戦闘・戦闘の定期掃除・完全な管理画面を含みません。したがって、管理画面や戦闘を本番で利用する場合は、この起動形態の差異を解消してからデプロイする必要があります。

## モジュール責務

| パス | 責務 | 主な依存先 |
| --- | --- | --- |
| `src/config/` | 環境ファイル選択、必須変数検証、Mongo 接続と SRV フォールバック | `dotenv`, `mongoose` |
| `src/models/` | MongoDB スキーマとインデックス | Mongoose |
| `src/functions/handlers/` | コマンド／イベントのファイル走査と Discord への登録 | Discord REST, `fs` |
| `src/events/client/` | Discord の ready、参加、interaction を受信 | helpers, game, battle controller |
| `src/commands/tools/` | スラッシュコマンドの定義と実行 | models, JSON データ |
| `src/helpers/` | メッセージ型コマンドのユースケース | models, game, services |
| `src/helpers/admin/` | 管理者専用メッセージコマンド | models, game |
| `src/game/` | ショップカード、購入、インベントリ Embed | models, Discord UI |
| `src/services/` | 戦闘の状態遷移、表示、画像 URL／同期 | models, Discord UI |
| `src/data/` | 設定、メニュー、話題、モンスター／アイテムのシード原本 | JSON / JS map |
| `src/scripts/` | モンスター・戦闘アイテムの upsert、R2 画像確認 | config, models, services |
| `src/server.js` | EJS のアイテム CRUD とゲームデータ JSON API | Express, models |
| `src/public/`, `src/views/` | 管理画面の HTML/CSS/ブラウザ側 UI | Express API |

## 代表的なデータフロー

### 登録と通常コマンド

1. `bot.js` が `!` または `！` のメッセージを解析する。
2. 雑談系（メニュー・話題・深夜・ping）は登録前でも実行する。
3. それ以外のユーザーコマンドでは `User` を検索し、未登録なら初期豆 10 と `welcome_coffee` を保存する。
4. helper が Mongoose を直接呼び、Discord に返信する。

参加イベント (`guildMemberAdd`) でも同じ初期データで登録します。`/register` はスラッシュコマンド用の明示登録です。

### 戦闘

1. 管理者の `!戦闘` が `helpers/battle.js` を呼ぶ。
2. `battleService.createSoloBattle` がプレイヤーとモンスターの値を **Battle にスナップショット** して作成する。
3. Discord ボタンを `interactionCreate` → `battleController` が受ける。
4. service が MongoDB の条件付き更新でアクションロックを取得し、状態を遷移する。
5. `battleView` が永続状態から Embed／ボタンを構築する。勝利時だけ `grantBattleReward` が `User` を更新する。

### 管理画面

1. ブラウザが `/admin/data` を開き、`game-data.js` が JSON API を取得する。
2. `/api/admin/monsters` と `/api/admin/items` が検索、ページング、CRUD を Mongoose に渡す。
3. 旧アイテム画面は `/`、`/items/*` の EJS form を使う。

## 設計上の注意点・改善対象

- 既存の handlers/helpers/controllers はモデルを直接操作しています。今後は、特に残高・購入・認可をサービスに集約し、コマンド／HTTP ルートを薄い入口にしてください。
- Web 管理画面と JSON の管理 API には認証・認可がありません。インターネットに公開してよい設計ではありません。
- `User.user_id` のスキーマは `Number` ですが、Discord snowflake は安全な JavaScript 整数の範囲を超えます。一方 Battle は文字列で正しく保存します。新規実装ではユーザー ID を文字列として扱い、型移行を計画してください。
- ショップ購入はボタン custom ID の価格を信頼し、残高減算と在庫追加を 1 回の原子的更新にしていません。ドメインルールを満たす購入サービスへの移行が必要です。
- `combined.js` と `bot.js` はドリフトしやすい重複入口です。変更時には両方の挙動を確認してください。
