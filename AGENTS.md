# Codex 作業規約

## 作業前

1. このファイルを最後まで読み、リポジトリ構造を確認する。
2. 詳細な設計・ルールは [`docs/`](docs/README.md) を読み、特に [`docs/architecture.md`](docs/architecture.md)、[`docs/domain-rule.md`](docs/domain-rule.md)、対象モジュールの文書を理解する。
3. 実装を始める前に、影響するモジュール、再利用できる既存モジュール、従うべきポリシー、参照・実行すべきテストを特定する。
4. コードベースを検索し、既存の service、utility、model、validator、API client、権限・エラー処理、テストを確認する。

## 実装原則

- 並行した別実装を作らず、既存モジュールの拡張を優先する。
- validation、DB access、API client、formatting、authorization、logging、cache、error handling を重複実装しない。
- 新しい抽象化を導入する前に検索する。新しい utility が必要なら、検討した既存 utility／service を変更説明に列挙する。
- 既存の DI とモジュール境界に従う。controller、Discord command handler、Express route から DB に直接アクセスしない。共通認可・validation を迂回しない。
- 金額、在庫、報酬、クールダウン、権限の変更では `docs/domain-rule.md` を不変条件として扱う。
- 無関係なリファクタリング、公開インターフェース変更、依存追加は避ける。必要なら理由と互換性への影響を説明する。
- `bot.js` と `combined.js` の起動形態差、既存の未認可 Web API、`User.user_id` の Number 定義を認識し、問題を増やさない。

## 計画と検証

- 複数モジュール・データモデル・API、またはおおむね 5 ファイル超に影響する変更は、実装前に対象ファイル、再利用部品、リスク、テストを含む短い計画を示す。ユーザーが実装を明示的に依頼していない場合は承認を待つ。
- 変更後は `npm test` を実行し、変更領域に応じた focused test と手動確認を行う。`npm run lint`、`npm run typecheck`、`npm run build` は現状 scripts がないため、存在しないものを実行済みと報告しない。
- 完了報告には、変更内容、再利用した既存モジュール、追加／変更ファイル、実行した検証、既知の制約を含める。

## 文書更新

- 動作、schema、API、コマンド、環境変数、運用手順、テスト方針を変えたら、該当する `docs/` と利用者に影響する場合の `README.md` を同じ変更で更新する。
- システム詳細を `AGENTS.md` に複製しない。詳細は `docs/` に置き、この規約は判断・作業ルールに限定する。
