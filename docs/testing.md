# テスト方針

## 現在の自動テスト

実行コマンドは次です。

```bash
npm test
```

`node --test` が `test/battleFoundation.test.js` を実行します。現在は外部サービス不要の unit test で、主に次を守ります。

- monster seed の体数（通常 14、ボス 6）と mechanic 数
- Battle の開始時スナップショット、legacy player の基礎値、期限判定、クールダウン
- ダメージ、勝敗、調査ボーナス、回復／弱点アイテム選択
- 特殊リアクションの発生・解決・再発防止
- battle custom ID と Discord button の構成
- R2 URL、未検証画像フォールバック、被弾差分、勝敗画面

現状、`lint`、`typecheck`、`build` の npm script は存在しません。作業完了時は存在しないチェックを実行済みと報告せず、`npm test` と実行した手動確認を明示してください。

## 変更別の最低確認

| 変更領域 | 自動テスト | 手動確認 |
| --- | --- | --- |
| `battleService` | `npm test`。分岐追加時は pure function test | 開始、操作本人以外の拒否、連打、期限、勝敗、再挑戦 |
| `battleView` / custom ID | `npm test`。button 配列と payload を検証 | Discord 上の Embed、ボタン無効化、画像差分 |
| monster / battle item seed | `npm test`、対象環境で seed | 管理画面の表示、R2 URL とフラグ |
| Discord command/helper | `npm test` に影響がなければ既存が通ること | 未登録／登録済み、権限なし／あり、エラー文言 |
| ItemMaster / shop / 通貨 | 追加したサービスの成功・残高不足・並行要求 test | 残高、在庫、価格、失敗時の不変性 |
| Express API / UI | API route test を追加する | 400/404/500、検索、ページング、作成・編集・削除、認可 |
| 設定・起動 | `npm test` | `REGISTER_COMMANDS=false` で Bot 起動、`/health`、環境ファイル選択 |

## 今後追加すべきテスト

優先度順です。

1. 通貨・購入サービスの原子性: 残高不足、同時購入、偽造価格、失敗時ロールバック。
2. 登録の競合: 参加イベントと初回コマンド／`/register` が同時に来ても初期報酬 1 回。
3. 戦闘報酬の障害回復: User 更新と Battle フラグ更新の間の例外を再実行しても二重付与しない。
4. Express 管理 API の認証、認可、入力正規化、削除時の参照整合性。
5. memo のページング、リアクション削除、5 分 timeout。

## テストデータの扱い

- unit test は `new Date(...)` と固定の UUID を渡して、時刻とランダム性を決定的にします。
- `prepareSpecialReaction` の確率は random 関数を注入できるため、`0.1` などを渡して検証します。
- 実 DB を使う検証は開発 URI だけで行い、`MONGO_URI` の接続先を出力で必ず確認します。
- Discord API、MongoDB、R2 に依存する E2E テストを追加する場合は、unit test と分け、環境変数がない通常の `npm test` を壊さないでください。
