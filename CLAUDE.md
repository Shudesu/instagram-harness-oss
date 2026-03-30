# LINE Harness — 開発ルール

## 必読ドキュメント

- **[OSS 同期憲章](docs/OSS-SYNC-CHARTER.md)** — Private ↔ OSS の同期ルール。OSS PR マージ後の逆マージ、シークレット保護、リリースフローの全ルール。

## バージョニング

### 統一バージョン方針

プロジェクト全体で **1つのバージョン番号** を使う。npm パッケージも同じバージョンに揃える。

| バージョン | package.json | git tag | npm |
|-----------|-------------|---------|-----|
| v0.6.0 | `packages/sdk/package.json` | `v0.6.0` | `@line-harness/sdk@0.6.0` |
| v0.6.0 | `packages/mcp-server/package.json` | — | `@line-harness/mcp-server@0.6.0` |

### semver ルール

- **patch** (0.6.x): バグ修正、ツールの小さな改善
- **minor** (0.x.0): 新機能追加（ツール追加、API追加、検索機能等）
- **major** (x.0.0): 破壊的変更（API変更、DB マイグレーション必須）

### バージョンアップ手順

1. `CHANGELOG.md` にエントリ追加
2. SDK の `package.json` バージョン更新
3. MCP Server の `package.json` バージョン更新（SDKと同じバージョン）
4. `pnpm --filter @line-harness/sdk build && pnpm --filter @line-harness/sdk test`
5. `pnpm --filter @line-harness/mcp-server build`
6. SDK publish: `cd packages/sdk && pnpm publish --access public --no-git-checks`
7. MCP publish: `cd packages/mcp-server && pnpm publish --access public --no-git-checks`
8. git commit + push
9. OSS リポ同期 + git tag

### npm publish は pnpm で

`npm publish` ではなく **`pnpm publish`** を使う。`workspace:*` が自動で実バージョンに変換される。

## リポジトリ構成

### 2つのリポジトリ

| リポ | 用途 | URL |
|------|------|-----|
| `Shudesu/line-harness` | プライベート（開発用） | private |
| `Shudesu/line-harness-oss` | パブリック（OSS公開） | github.com/Shudesu/line-harness-oss |

### OSS 同期ルール

- プライベートで開発 → OSS に同期
- `scripts/sync-oss.sh` で同期（シークレット除去）
- OSS リポに git tag を付ける（`v0.6.0` 等）
- `CHANGELOG.md`, `README.md` は OSS に含めない（sync-oss.sh で除外済み）

## デプロイ

### 本番環境

- **CF アカウント**: aiagent.mini@gmail.com (ID: `37f8f88be4c099329e4647bda211bb9f`)
- **Worker名**: `line-crm-worker`（wrangler.toml の `name` とは異なる）
- **D1**: `line-crm` (ID: `b2712617-31c4-47c2-accd-4eec906c44ce`)
- **デプロイ元**: Mac Mini SSH

### デプロイ手順

```bash
# Mac Mini で pull
ssh macmini 'export PATH="$HOME/.local/share/fnm/aliases/default/bin:$PATH" && cd ~/claudecode/line-oss-crm && git pull origin main'

# wrangler.toml を本番用に変更してデプロイ
ssh macmini '... && cd apps/worker && \
  sed -i "" "s/account_id = \"c40947ff58a767be74a53be79a89d68a\"/account_id = \"37f8f88be4c099329e4647bda211bb9f\"/" wrangler.toml && \
  sed -i "" "s/database_name = \"line-harness\"/database_name = \"line-crm\"/" wrangler.toml && \
  sed -i "" "s/database_id = \"7efe7c20-01ae-4d65-be08-0d7b4202e8a1\"/database_id = \"b2712617-31c4-47c2-accd-4eec906c44ce\"/" wrangler.toml && \
  npx wrangler deploy --name line-crm-worker'

# wrangler.toml を元に戻す
ssh macmini '... && cd apps/worker && git checkout wrangler.toml'
```

### wrangler.toml について

- ローカルの wrangler.toml は**テスト用アカウント**の設定
- 本番デプロイ時は sed で一時的に書き換えて deploy → git checkout で戻す
- **wrangler.toml を本番設定のままコミットしない**

## MCP サーバー

- `.mcp.json` は `.gitignore` 済み（APIキーを含むため）
- MCP ツールの追加時は `manage_*` パターンで同一リソースのCRUDをまとめる
- メッセージ送信系ツール（`send_message`, `broadcast`）は**ユーザー確認なしで実行しない**

## コード規約

- TypeScript strict mode
- Hono フレームワーク（Worker）
- snake_case（DB/API）→ camelCase（SDK/フロント）変換は serialize 関数で
- テスト: Vitest（SDK）
- ビルド: tsup（SDK, MCP Server）
