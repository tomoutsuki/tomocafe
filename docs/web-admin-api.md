# Web 管理画面・API

## 構成

`src/server.js` は Express 5、EJS、`body-parser`、Mongoose で動きます。静的ファイルは `src/public/`、テンプレートは `src/views/` です。

| URL | UI | 実装 |
| --- | --- | --- |
| `/` | 従来の ItemMaster 一覧・フォーム | `index.ejs`, `form.ejs`, `style.css`, `form.js` |
| `/admin/data` | モンスター／アイテムの表・詳細パネル | `game-data.ejs`, `game-data.js`, `game-data.css` |
| `/health` | `{ environment, status: "ok" }` | Express route |

`game-data.js` は URL query に検索・フィルタ・ソート・ページ情報を保持し、inline 編集や詳細フォームから JSON API を呼びます。

## 管理 JSON API

すべて JSON。ページング形式は `{ "data": [...], "pagination": { "page", "limit", "total" } }` です。ページ上限は 100、`direction` は `asc` または既定の `desc` です。

| Method / path | 用途 | Query / body |
| --- | --- | --- |
| `GET /api/admin/monsters` | モンスター一覧 | `search`, `rarity`, `enabled`, `category`, `minHp`, `maxHp`, `page`, `limit`, `sort=name|id|hp|rarity|updatedAt`, `direction` |
| `POST /api/admin/monsters` | モンスター作成 | Monster JSON。必須不足は既定値で補うが `monster_id` は実質必須 |
| `PATCH /api/admin/monsters/:id` | ObjectId 指定で部分更新 | 更新したい field のみ |
| `DELETE /api/admin/monsters/:id` | ObjectId 指定で削除 | 204 または 404 |
| `GET /api/admin/items` | アイテム一覧 | `search`, `rarity`, `enabled`, `category`, `page`, `limit`, `sort=name|id|hp|rarity|updatedAt`, `direction`。`hp` は価格を指す |
| `POST /api/admin/items` | アイテム作成 | ItemMaster JSON。ID 未指定なら `item_<timestamp>` |
| `PATCH /api/admin/items/:id` | ObjectId 指定で部分更新 | 更新したい field のみ |
| `DELETE /api/admin/items/:id` | ObjectId 指定で削除 | 204 または 404 |

`search` は正規表現メタ文字を escape した部分一致・大文字小文字なし検索です。`enabled=true` は `is_enabled !== false`、つまり旧データの未設定値も有効として扱います。

### Monster 作成例

```http
POST /api/admin/monsters
Content-Type: application/json

{
  "monster_id": "sample_slime",
  "name_ja": "サンプル・スライム",
  "rarity": "common",
  "difficulty": 1,
  "category": "コーヒー",
  "tags": ["コーヒー"],
  "battle": {
    "max_hp": 20,
    "attack": 4,
    "defense": 1,
    "reward_beans": 2,
    "attack_text": "跳ねた！"
  },
  "mechanics": [{
    "pattern": "weakness_exposure",
    "trigger": "turn_2_once",
    "message": "大きく跳ねた！",
    "hint": "今なら狙えそうだ。"
  }]
}
```

Mongoose の enum や required 制約に反するデータ、重複 logical ID は 400 を返します。レスポンスの 500 はサーバーエラーです。

## 従来のアイテム画面と公開 API

| Method / path | 内容 |
| --- | --- |
| `GET /` | ItemMaster 一覧の EJS |
| `GET /items/new` | 新規作成フォーム |
| `POST /items` | form body からアイテム作成、`/` に redirect |
| `GET /items/:id/edit` | ObjectId の編集フォーム |
| `POST /items/:id` | form body で更新、`/` に redirect |
| `POST /items/:id/delete` | 削除、`/` に redirect |
| `GET /api/items` | 全アイテム配列 |
| `GET /api/items/:id` | ObjectId の 1 件 |

## 運用・セキュリティ上の制約

現時点の `server.js` の管理機能にはログイン、Discord ロール照合、CSRF 対策、監査ログがありません。したがって次の扱いを必須とします。

- 外部公開しない。少なくとも内部ネットワーク、VPN、または認証リバースプロキシの内側に置く。
- 本番でデータ変更を許可する前に、Web 側の共通認可と監査ログを導入する。
- 削除は参照整合性を確認する。ItemMaster の削除は既存の User 在庫や戦闘スナップショットとの表示に影響する。
- HTTP route がモデルを直接更新している現状を新規の設計として踏襲しない。サービス境界で validation / authorization / audit を共通化する。

`src/combined.js` で起動した場合、完全な管理画面は提供されず、`/` は Bot の状態 JSON、`/health` は詳細 health JSON になります。運用時はどの entry point を使うかを明示してください。
