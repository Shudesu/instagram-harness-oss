# Instagram Harness — 開発ルール

## コード規約
- TypeScript strict mode
- Hono フレームワーク（Worker）
- snake_case（DB/API）→ camelCase（SDK/フロント）変換は serialize 関数で
- ビルド: tsup（SDK, MCP Server）

## デプロイ
- `cd apps/worker && wrangler deploy`
- シークレットは `wrangler secret put` で設定
- wrangler.toml の account_id と database_id は自分の環境に合わせて変更

## MCP サーバー
- `.mcp.json` は `.gitignore` 済み（APIキーを含むため）
