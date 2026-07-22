# 戦闘システム

## 目的と現在の公開範囲

戦闘は MongoDB に状態を保存するターン制 UI です。現在の開始入口は管理者専用 `!戦闘` で、常に `expresso_slime` を使うバランス／表示確認用のテストです。戦闘エンジン自体は任意の `Monster` を受け取るため、一般向け遭遇機能はこの service を再利用して実装してください。

## モジュール境界

| モジュール | 責務 |
| --- | --- |
| `helpers/battle.js` | コマンド入口。ユーザー・既定モンスターを取得し、テスト用の `ignoreCooldown` と `forceRestart` を指定 |
| `services/battleService.js` | 状態生成、計算、DB 条件更新、ロック、アイテム消費、報酬、クールダウン |
| `services/battleController.js` | Discord interaction を service 呼び出しへ変換し、攻撃演出を制御 |
| `services/battleView.js` | 永続 Battle を Embed とボタン payload に変換 |
| `services/battleCustomId.js` | `battle:<action>:<uuid>` のパース |
| `models/Battle.js` | 永続スナップショット、インデックス、ライフサイクル |
| `models/Monster.js`, `models/User.js`, `models/ItemMaster.js` | 開始時の元データ、インベントリ、戦闘アイテムマスター |

入口は表示を作るだけにし、ダメージ・消費・報酬を controller や helper に重複させないでください。

## 戦闘ライフサイクル

```text
createSoloBattle
   │ (player/monster 値を Battle にスナップショット)
   ▼
active ── 攻撃 / アイテム / 調査 / 特殊選択 ──► active
   │                                  │
   │                                  ├─► won ─► reward_claimed + cooldown
   │                                  └─► lost ─► cooldown
   ├─► cancelled
   └─► timed_out
```

- `expires_at` は既定で開始から 30 分。`BATTLE_TIMEOUT_MINUTES` で上書きできます。
- Bot 起動時と 5 分ごとに `expireStaleBattles` が active かつ期限切れの戦闘を `timed_out` にします。
- `createSoloBattle` はプレイヤー当たり 1 件の active 戦闘を DB の部分 unique index で保証します。競合時は既存を返します。
- テスト用 `forceRestart` は既存 active を `cancelled` にしてから作り直します。一般向け入口では使いません。

## ロックと冪等性

`acquireActionLock` / `acquireSpecialReactionLock` は、以下を満たす戦闘だけを `findOneAndUpdate` でロックします。

- `status: active`
- `expires_at > now`
- 通常操作では特殊反応が非 active、特殊操作では active
- `action_lock: false`、またはロック時刻が 15 秒より古い

状態の書込みは `finishBattle` を通し、ロックを解除して履歴を最大 12 件に切り詰めます。表示演出中に失敗しても controller は状態を完了させてロック残留を防ぎます。

勝利報酬では `User.battle_reward_ids: { $ne: battle_id }` を条件に `$inc` と `$addToSet` を実行します。同一 battle ID での再実行は残高を増やしません。これは報酬のサービスであり、controller 側に複製してはいけません。

## 通常行動

### 攻撃

`damage = max(1, floor(attack) - floor(defense))` です。

1. `player_attack + next_attack_bonus` でモンスターにダメージ。
2. モンスター HP が 0 なら勝利し、反撃しない。
3. 生存時は `monster_attack` でプレイヤーに反撃。
4. プレイヤー HP が 0 なら敗北、それ以外は active。
5. ターンを 1 増やし、`next_attack_bonus` を 0 に戻す。

攻撃画面は defer してから、攻撃宣言（1.5 秒）→被弾画像（2 秒）→敵攻撃（1.5 秒）→被ダメージ（2 秒）を表示します。演出の値は `battleController.js` にあります。

### 調査

1 戦 1 回だけです。モンスターの説明、弱点説明、内蔵弱点アイテム、mechanic hint を表示し、次の**通常攻撃だけ**に +3 を設定します。アイテム・特殊反応ではこのボーナスの扱いがパターンごとに定義されるため、`resolveAttack` / `resolveSpecialReaction` を変更するときはテストを更新してください。

### アイテム

- 回復候補は、失った HP を満たせる最小の回復値、なければ最大回復値を選ぶ。
- 推薦候補はモンスタータグに一致する weakness 効果のうち最大値を選ぶ。
- `heal` は最大 HP を超えず、`weakness` は固定ダメージを与える。
- 使用できる 1 個を `User.items.$.quantity` の `quantity > 0` 条件で減らしてから状態を進める。相手が生存していれば反撃する。
- マスター未登録の旧配布品は `BUILTIN_BATTLE_EFFECTS`（welcome_coffee / warm_milk / sugar_cube / sticky_syrup）で後方互換する。

## 特殊リアクション

Monster の mechanic は、現実装では `trigger` が `turn_<数>` で始まるターンにだけ候補になります。通常敵の難度 1 は 35% の確率、難度 2 以上とボスは確定です。使用済み index は `used_mechanic_indices` に記録します。

| seed pattern | 正規化後 | UI と効果 |
| --- | --- | --- |
| `heavy_attack_warning` | 同左 | よける（無傷）、ガード（強攻撃の半分）、攻め続ける（通常攻撃＋強反撃） |
| `weakness_exposure` | 同左 | 弱点を狙う（+5 攻撃＋通常反撃）、安全に攻撃（通常攻撃、反撃なし） |
| `interruptible`, `summon` | `interruptible` | 妨害する（次回通常攻撃 +3）、攻撃を続ける（通常攻撃＋強反撃） |
| `item_weakness` | `weakness_exposure` | パターン自体の正規化はあるが、seed の `trigger: item_use` は現実装で発火しない |

新パターンを追加する場合は、Monster enum、正規化 map、解決ロジック、button parser、view、シード、少なくとも unit test を同時に更新します。

`item_use` のような非ターン trigger を有効にするには、`prepareSpecialReaction` だけでは足りません。アイテム操作の状態遷移に明示的な trigger 判定を追加し、既存のロック・アイテム消費・再発防止と一緒にテストしてください。

## 画像

- 通常画像: `R2_URL/default/<monster_id>.png`
- 被弾差分: `R2_URL/damage/<monster_id>.png`
- 結果スタンプ: `R2_URL/stamps/shouri.png`, `R2_URL/stamps/haiboku.png`

R2 URL の存在が確認済みなら使用し、未確認時は `data/monsterImages.js` の旧サムネイルへフォールバックします。`show_damage_image` は被弾演出中だけ差分を選ぶフラグです。

## 拡張チェックリスト

一般向けの戦闘開始、モンスター追加、報酬変更の前に次を確認してください。

1. `Monster` を有効・存在確認し、開始 service に渡す。`Battle` のスナップショットを直接組み立てない。
2. `createSoloBattle` の通常クールダウンを有効にし、テスト用 `ignoreCooldown` / `forceRestart` を持ち込まない。
3. 既存の `battleService` を拡張し、helper/controller からモデルを直接更新しない。
4. seed JSON、Mongoose enum、画像同期、管理画面編集可否を整合させる。
5. `test/battleFoundation.test.js` に純粋計算と UI custom ID のテストを追加し、`npm test` を実行する。
