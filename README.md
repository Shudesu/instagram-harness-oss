# Instagram Harness

Instagram DM自動化のオープンソースCRM。ManyChat・iステップの代替として、セルフホストで月額0円。

## 特徴

- **コメント→DM自動送信** — 投稿/リールにコメントしたらDMで特典配布
- **コメント自動リプライ** — コメントに自動返信（カスタマイズ可能）
- **ステップ配信** — キーワードトリガーで時間差DM連続送信
- **リッチメッセージ** — ボタン付きカード、カルーセル、クイックリプライ
- **一斉配信** — 全フォロワー or タグ絞り込みでDM一斉送信
- **フォーム** — DM内でデータ収集
- **トラッキングリンク** — クリック計測、流入経路分析
- **ストーリーメンション→DM** — メンションしてくれた人に自動DM
- **LINE Harness連携** — UUID紐づけでIG×LINEクロスプラットフォーム統合
- **MCP対応** — Claude Codeから全操作可能（23ツール）
- **管理画面** — ダッシュボード、フォロワー一覧、コメントルール管理

## アーキテクチャ

```
Cloudflare Workers (Hono) + D1 (SQLite) + R2 (画像)
```

- **Worker**: Webhook受信、API、Cron配信
- **D1**: フォロワー、タグ、シナリオ、コメントルール等
- **R2**: 画像ホスティング
- **Admin UI**: Next.js 15 + Tailwind (CF Pages)

## セットアップ（15分）

> 詳細は [docs/QUICKSTART.md](docs/QUICKSTART.md) を参照

### 1. Meta App作成
developers.facebook.com → アプリ作成 → 「Instagramでメッセージとコンテンツを管理」

### 2. テスター追加 & トークン生成
Instagram APIダッシュボードでIGアカウントを接続、トークン生成

### 3. デプロイ
```bash
git clone https://github.com/Shudesu/instagram-harness.git
cd instagram-harness/apps/worker

wrangler d1 create instagram-harness
wrangler r2 bucket create instagram-harness-images
wrangler d1 execute instagram-harness --remote --file=../../packages/db/schema.sql

echo "YOUR_SECRET" | wrangler secret put IG_APP_SECRET
echo "YOUR_TOKEN" | wrangler secret put IG_ACCESS_TOKEN
echo "YOUR_ID" | wrangler secret put IG_USER_ID
echo "YOUR_VERIFY" | wrangler secret put IG_VERIFY_TOKEN
echo "$(openssl rand -hex 32)" | wrangler secret put API_KEY

wrangler deploy
```

### 4. Webhook設定
Meta Developer Console → コールバックURL設定 + アカウントレベルサブスクリプション

### 5. 公開
プライバシーポリシーURL設定 → 公開トグル → ルーティング設定

## SDK

```bash
npm install @instagram-harness/sdk
```

```typescript
import { InstagramHarness } from '@instagram-harness/sdk';

const client = new InstagramHarness({
  apiUrl: 'https://your-worker.workers.dev',
  apiKey: 'your-api-key',
});

// フォロワー一覧
const { items } = await client.followers.list();

// コメントルール作成
await client.commentRules.create({
  name: 'プロモ',
  keyword: '詳細',
  matchType: 'contains',
  responseType: 'template',
  responseBody: {
    elements: [{
      title: '🎁 特典はこちら',
      buttons: [{ type: 'web_url', url: 'https://...', title: '受け取る' }]
    }]
  },
});

// ブロードキャスト
await client.broadcasts.create({
  name: 'キャンペーン',
  messageType: 'text',
  body: JSON.stringify({ text: '📢 お知らせ！' }),
});
```

## MCP (Claude Code連携)

```json
{
  "mcpServers": {
    "instagram-harness": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "INSTAGRAM_HARNESS_API_URL": "https://your-worker.workers.dev",
        "INSTAGRAM_HARNESS_API_KEY": "your-api-key"
      }
    }
  }
}
```

Claude Codeから自然言語で操作:
- 「フォロワー一覧を見せて」
- 「"仕組み"というコメントが来たらDMで特典を送るルールを作って」
- 「全フォロワーにキャンペーンDMを送って」

## LINE Harness連携

Instagram × LINEのクロスプラットフォーム統合。ManyChat単体では不可能。

1. IGコメント → DM（LINE追加ボタン付き、`ref=ig_{{igsid}}`）
2. ユーザーがLINE友だち追加
3. LINE Harnessが流入経路を自動記録（`ref_code`）
4. UUID紐づけで両プラットフォームのユーザー情報を統合

## プロジェクト構成

```
instagram-harness/
├── apps/
│   ├── worker/     # Cloudflare Workers (API + Webhook)
│   └── web/        # Next.js 管理画面
├── packages/
│   ├── sdk/        # TypeScript SDK (@instagram-harness/sdk)
│   ├── mcp-server/ # MCP Server (@instagram-harness/mcp-server)
│   ├── ig-sdk/     # Instagram Graph API ラッパー
│   ├── db/         # D1 スキーマ + クエリ
│   └── shared/     # 共有型定義
└── docs/
    ├── QUICKSTART.md  # 15分セットアップ
    ├── SETUP-GUIDE.md # 全罠と解決策
    └── API.md         # REST API + SDK + MCP リファレンス
```

## ドキュメント

- [15分クイックスタート](docs/QUICKSTART.md)
- [セットアップガイド（全罠と解決策）](docs/SETUP-GUIDE.md)
- [API リファレンス](docs/API.md)

## ManyChat vs Instagram Harness

| 機能 | ManyChat | Instagram Harness |
|------|----------|-------------------|
| コメント→DM | ✅ | ✅ |
| ステップ配信 | ✅ | ✅ |
| リッチメッセージ | ✅ | ✅ |
| 一斉配信 | ✅ | ✅ |
| コメントリプライ | ✅ | ✅ |
| ストーリーメンション | ✅ | ✅ |
| LINE連携 | ❌ | ✅ |
| Claude Code操作 | ❌ | ✅ (MCP) |
| セルフホスト | ❌ | ✅ |
| 月額 | $15〜 | 0円 |
| データ所有権 | ManyChat | あなた |

## ライセンス

MIT
