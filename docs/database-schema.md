# データベーススキーマ

MongoDB + Mongoose を使用します。コレクション名はモデル定義の第 3 引数で固定です。日時は MongoDB Date、Discord ID は文字列で保存するのがドメイン上の正しい扱いです（ただし `user.user_id` は現状 Number 定義という移行課題があります）。

## `user` — プレイヤー

| Field | 型 / 既定値 | 説明 | 例 |
| --- | --- | --- | --- |
| `_id` | ObjectId | MongoDB 主キー | `"66d..."` |
| `user_id` | Number（現状） | Discord ユーザー ID。**将来は String に移行** | `123456789012345678` |
| `join_date` | Date / 現在時刻 | 初回登録日時 | `"2026-07-22T12:00:00Z"` |
| `last_daily_claim` | Date / 登録 24 時間前 | 最終デイリー受領日時。初回をすぐ受領可能にする | `"2026-07-21T12:00:00Z"` |
| `beans` | Number / `0` | コーヒー豆残高。0 未満不可というドメイン制約 | `15` |
| `stats.max_hp` | Number / `30`, min `1` | 戦闘開始時の最大 HP | `30` |
| `stats.attack` | Number / `10`, min `1` | 戦闘開始時の攻撃 | `10` |
| `stats.defense` | Number / `2`, min `0` | 戦闘開始時の防御 | `2` |
| `battle_reward_ids` | String[] / `[]` | 報酬済み battle ID。二重付与防止 | `["uuid"]` |
| `battle_cooldown_until` | Date / `null` | 次の通常戦闘を開始できる時刻 | `"2026-07-22T12:05:00Z"` |
| `items[]` | subdocument[] | 所持アイテム | 下記 |
| `items[].item_id` | String | `item_master.item_id` を指す論理キー | `"welcome_coffee"` |
| `items[].quantity` | Number / `1` | 所持数。0 未満禁止 | `2` |

例:

```json
{
  "user_id": "123456789012345678",
  "beans": 10,
  "stats": { "max_hp": 30, "attack": 10, "defense": 2 },
  "battle_reward_ids": [],
  "battle_cooldown_until": null,
  "items": [{ "item_id": "welcome_coffee", "quantity": 1 }]
}
```

## `item_master` — アイテム定義

`timestamps: true` のため `createdAt` と `updatedAt` を持ちます。`item_id` は unique です。

| Field | 型 / 既定値 | 説明 | 例 |
| --- | --- | --- | --- |
| `item_id` | String, unique | 不変のアイテム論理 ID | `"warm_milk"` |
| `title` | String | 表示名 | `"温かいミルク"` |
| `description` | String | プレイヤー／管理者向け説明 | `"コーヒー系の動きを鈍らせる。"` |
| `category` | String / `""` | 分類 | `"戦闘アイテム"` |
| `acquisition_method` | String / `""` | 入手方法の説明 | `"ショップ"` |
| `rarity` | enum / `"ノーマル"` | `ノーマル`、`レア`、`スーパーレア`、`ウルトラレア` | `"レア"` |
| `is_enabled` | Boolean / `true`, index | 新規利用を許可するか | `true` |
| `image_url` | String | 表示画像 URL | `"https://.../milk.png"` |
| `market_price` | Number / `0` | 1 個あたりの豆価格。0 以上 | `8` |
| `battle_effect` | object / `null` | 戦闘効果。非戦闘アイテムは null | 下記 |
| `battle_effect.kind` | enum, required | `heal` または `weakness` | `"weakness"` |
| `battle_effect.value` | Number, min `1` | `heal` は回復量、`weakness` は固定ダメージ | `5` |
| `battle_effect.target_tags` | String[] / `[]` | weakness が推薦対象となるモンスタタグ | `["コーヒー"]` |

```json
{
  "item_id": "warm_milk",
  "title": "温かいミルク",
  "rarity": "ノーマル",
  "market_price": 8,
  "battle_effect": { "kind": "weakness", "value": 5, "target_tags": ["コーヒー"] }
}
```

## `monsters` — モンスターマスター

`monster_id` は unique + index、`is_boss` と `is_enabled` も index です。`timestamps: true` を使います。シード原本は `src/data/monsters.json` で、現在は通常 14 体・ボス 6 体です。

| Field | 型 / 制約 | 説明 | 例 |
| --- | --- | --- | --- |
| `monster_id` | String, required, unique | 不変の論理 ID | `"expresso_slime"` |
| `name_ja` / `name_en` | String / required, String | 日本語名／英語名 | `"エスプレッソ・スライム"` |
| `is_boss` | Boolean / false | ボスかどうか | `false` |
| `rarity` | enum, required | `common`、`uncommon`、`rare`、`boss` | `"common"` |
| `is_enabled` | Boolean / true | 出現・利用可否。旧データの未設定は API で有効扱い | `true` |
| `difficulty` | Number, 1–5 | 難度。2 以上とボスは特殊反応が確定発生 | `1` |
| `category` | String | 例: `コーヒー`、`スイーツ` | `"コーヒー"` |
| `battle_role` | String | デザイン用の役割名 | `"基本型"` |
| `appearance` / `behavior` | String | 外見／行動説明。Battle の説明へスナップショット | `"デミタスカップから…"` |
| `image_url` | String / null | 通常画像。通常は R2 `default/<id>.png` | `"https://assets/default/expresso_slime.png"` |
| `has_default_image` | Boolean / false | R2 通常画像の存在確認済みフラグ | `true` |
| `damage_image_url` | String / null | 被弾差分画像 URL | `"https://assets/damage/expresso_slime.png"` |
| `has_damage_diff` | Boolean / false | 差分画像の存在確認済みフラグ | `true` |
| `encounter_text` / `defeat_text` / `inspect_text` | String, required | 遭遇／撃破／調査の文言 | `"…無防備になる。"` |
| `tags` / `drops` | String[] / `[]` | 弱点推薦・検索用タグ／ドロップ設計情報 | `["スライム", "基本敵"]` |
| `battle` | object, required fields | 戦闘基礎値 | 下記 |
| `battle.max_hp` | Number, min `1` | 最大 HP | `28` |
| `battle.attack` | Number, min `1` | 攻撃 | `5` |
| `battle.defense` | Number, min `0` | 防御 | `1` |
| `battle.reward_beans` | Number, min `0` | 勝利豆 | `3` |
| `battle.attack_text` | String, required | 演出文言 | `"クレマ・スプラッシュ…"` |
| `mechanics[]` | object[] | 特殊反応の定義 | 下記 |
| `mechanics[].pattern` | enum, required | `heavy_attack_warning`、`weakness_exposure`、`interruptible`、`summon`、`item_weakness` | `"weakness_exposure"` |
| `mechanics[].trigger` | String / `future_phase` | 現実装は `turn_2_once` や `turn_3` の turn 数を読む | `"turn_2_once"` |
| `mechanics[].message` / `.hint` | String, required | 発生時の文言／調査ヒント | `"大きく飛び出した！"` |

## `battles` — 戦闘状態とスナップショット

`timestamps: true`、`versionKey: false`。`battle_id` は unique + index。`{ player_id, status, expires_at }` の index と、`status: active` のときだけ `player_id` を unique にする部分インデックスがあります。

| Field 群 | 主な Field | 説明・例 |
| --- | --- | --- |
| 識別・表示 | `battle_id`, `player_id`, `player_display_name`, `player_avatar_url`, `guild_id`, `channel_id`, `message_id` | UUID と Discord の文脈。Discord ID は String。 |
| 終了状態 | `status` | `active`、`cancelled`、`timed_out`、`won`、`lost`。初期値は active。 |
| モンスター識別 | `monster_id`, `monster_name`, `monster_image_url`, `monster_damage_image_url` | 開始時にコピー。後から master を変えても変わらない。 |
| 画像制御 | `has_default_image`, `has_damage_diff`, `show_damage_image` | R2 確認済み画像と一時的な被弾表示を制御。 |
| モンスター説明 | `monster_description`, `monster_inspect_text`, `monster_tags`, `monster_mechanic_hints`, `monster_mechanics`, `monster_is_boss`, `monster_difficulty` | 調査・特殊反応のためのコピー。`monster_mechanics[]` は pattern/trigger/message/hint。 |
| モンスター能力 | `monster_max_hp`, `monster_hp`, `monster_attack`, `monster_defense`, `reward_beans` | `max_hp` と attack は 1 以上、HP/defense/reward は 0 以上。 |
| プレイヤー能力 | `player_max_hp`, `player_hp`, `player_attack`, `player_defense` | `User.stats` の開始時コピー。 |
| ターン状態 | `turn`, `inspected`, `next_attack_bonus`, `inspection_message` | ターン数、調査済み、次回通常攻撃ボーナス。 |
| 特殊反応 | `special_reaction.active/pattern/message/mechanic_index`, `used_mechanic_indices` | 画面を特殊選択肢に切替え、同じ mechanic の再発を防ぐ。 |
| ログ | `last_action_message`, `recent_logs[].message/created_at` | 最後の説明と最大 12 件の履歴。 |
| ライフサイクル | `expires_at`, `finished_at` | 期限と終了時刻。active のみ期限切れ判定する。 |
| 排他・報酬 | `action_lock`, `action_locked_at`, `reward_claimed` | 15 秒で失効する操作ロックと報酬処理済みフラグ。 |

短縮例:

```json
{
  "battle_id": "123e4567-e89b-12d3-a456-426614174000",
  "player_id": "123456789012345678",
  "status": "active",
  "monster_id": "expresso_slime",
  "monster_hp": 28,
  "monster_max_hp": 28,
  "player_hp": 30,
  "player_max_hp": 30,
  "expires_at": "2026-07-22T12:30:00Z",
  "special_reaction": { "active": false },
  "reward_claimed": false
}
```

## `memo` — プレイヤーメモ

`timestamps: true` のため `createdAt` と `updatedAt` が付きます。`owner_id` は index です。

| Field | 型 / 制約 | 説明 | 例 |
| --- | --- | --- | --- |
| `owner_id` | String, required, index | 所有者の Discord ID | `"123456789012345678"` |
| `title` | String, required, trim, max 200 | メモ本文（1 行のタスク） | `"課題を終わらせる"` |
| `checked` | Boolean / false | 完了チェック状態 | `true` |
| `createdAt` / `updatedAt` | Date | 作成・更新時刻 | `"2026-07-22T12:00:00Z"` |

## データ投入と画像フラグ

- `seedMonsters.js` は `monsters.json` を `monster_id` ごとに upsert し、R2 の通常画像 URL を設定します。既存の `has_default_image` / `has_damage_diff` は必要に応じて保持します。
- `seedBattleItems.js` は `battleItems.json` を `item_id` ごとに upsert します。
- 画像確認は未確認フラグのモンスターだけを HTTP GET し、成功時に `has_default_image` / `has_damage_diff` と URL を更新します。
