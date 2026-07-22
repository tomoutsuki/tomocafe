# Services 層の Codex 規約

このディレクトリはドメイン状態遷移、外部画像アクセス、Discord 表示 payload を担います。詳細は [`../../docs/battle-system.md`](../../docs/battle-system.md) と [`../../docs/domain-rule.md`](../../docs/domain-rule.md) を読むこと。

## 戦闘変更の必須事項

- `battleController` は interaction と演出、`battleView` は表示、`battleService` は計算と状態遷移に限定する。これらの責務を混在させない。
- Battle の作成は `createBattleDraft` / `createSoloBattle` を使い、進行中の戦闘の master 値を再読込みして上書きしない。
- state を変える全操作は既存の action lock と `finishBattle` を通す。`Battle.update*` を controller や view に追加しない。
- 報酬は `grantBattleReward`、クールダウンは `applyBattleCooldown` を再利用する。豆・在庫を view／controller から変更しない。
- アイテム消費は `quantity > 0` を条件にした原子的な確保を維持する。消費できなければ戦闘を進めない。
- 新しい mechanic は Monster schema、pattern map、解決処理、custom ID parser、view、seed、unit test を一緒に更新する。未対応 pattern を暗黙に既存パターンへ落とさない。
- `active` 以外へ遷移した Battle を active に戻さず、HP・残高・在庫を負にしない。

## 画像・表示

- R2 URL は `monsterImageUrls` を通して生成し、未確認画像では既存フォールバックを保つ。
- `battleView` は永続 Battle から決定的に payload を作る純粋な表示層として保つ。DB／network I/O を追加しない。

## 検証

- `battleService`、`battleView`、`battleCustomId` を変えたら `npm test` を実行する。
- 新しい分岐には、成功・拒否・重複操作／期限切れの少なくともいずれかを含む `test/battleFoundation.test.js` のテストを追加する。
