# LINE Harness

LINE公式アカウント向けオープンソースCRM / マーケティングオートメーション。
L-step・Utage の代替として、無料（または低コスト）で運用できます。

## 機能

- **友だち管理** — Webhook で自動登録、タグ付け、セグメント分け
- **ステップ配信** — シナリオ作成、遅延配信、分岐条件、友だち追加/タグトリガー
- **一斉配信** — 全員 or タグ or セグメント絞り込み、予約配信
- **自動応答** — キーワードマッチ + アクションエンジン（タグ付与・メニュー切替・メタデータ設定）
- **フォーム** — LIFF内フォーム、回答→メタデータ自動保存
- **リッチメニュー** — ユーザー別切り替え対応
- **URL追跡** — 全リンク自動追跡、クリックしたユーザーを特定（LIFF連携）
- **スコアリング** — ルールベースの友だちスコアリング
- **スタッフ管理** — owner / admin / staff の3ロール、APIキーごとの権限制御
- **MCP Server** — Claude Code / AI エージェントから自然言語でLINE操作
- **SDK** — TypeScript SDK でプログラマティックに全機能を操作
- **管理画面** — Next.js ダッシュボードで直感的に操作
- **マルチアカウント** — 複数LINE公式アカウントを1つのDBで管理
- **BAN対策** — ステルス配信（ジッター・バッチ分散・メッセージ変異）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| API / Webhook | Cloudflare Workers + Hono |
| データベース | Cloudflare D1 (SQLite) |
| 定期実行 | Workers Cron Triggers (5分毎) |
| 管理画面 | Next.js 15 (App Router) + Tailwind CSS |
| LIFF | Vite + TypeScript (Cloudflare Pages) |
| SDK | TypeScript, ESM + CJS, ゼロ依存 |
| MCP Server | Model Context Protocol, `@line-harness/sdk` ベース |
| LINE連携 | LINE Messaging API + LINE Login (LIFF) |

## アーキテクチャ

```
LINE Platform ──→ CF Workers (webhook) ──→ D1
                                          ↑
Claude Code ──→ MCP Server ──→ SDK ──→ CF Workers (API) ──→ D1
                                          ↑
Vercel (Admin UI) ─────────────────→ CF Workers (API) ──→ D1
                                          ↑
CF Cron Trigger ──→ Workers ──→ LINE Messaging API
                                          ↑
LIFF (CF Pages) ──→ CF Workers (LIFF API) ──→ D1
```

## MCP Server (AI連携)

Claude Code や他のMCPクライアントから、自然言語でLINE公式アカウントを操作できます。

### セットアップ

```json
// .mcp.json
{
  "mcpServers": {
    "line-harness": {
      "command": "npx",
      "args": ["-y", "@line-harness/mcp-server@latest"],
      "env": {
        "LINE_HARNESS_API_URL": "https://your-worker.workers.dev",
        "LINE_HARNESS_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 利用可能なツール (25個)

| ツール | 説明 |
|--------|------|
| `send_message` | テキスト・画像・Flexメッセージ送信 |
| `list_friends` | 友だち一覧（名前検索・タグ・メタデータフィルタ対応） |
| `get_friend_detail` | 友だち詳細情報 |
| `manage_friends` | 友だち数取得・メタデータ更新・リッチメニュー割当/解除 |
| `manage_tags` | タグ一覧・作成・削除・友だちへのタグ付け/外し |
| `broadcast` | 一斉配信（即時・予約・セグメント） |
| `manage_broadcasts` | 配信一覧・詳細・下書き作成・更新・セグメント配信 |
| `create_scenario` | ステップ配信シナリオ作成 |
| `manage_scenarios` | シナリオ一覧・詳細・更新・削除・ステップCRUD |
| `enroll_in_scenario` | 友だちをシナリオに登録 |
| `create_form` | LIFFフォーム作成 |
| `manage_forms` | フォーム一覧・詳細・更新・削除 |
| `get_form_submissions` | フォーム回答データ取得 |
| `create_rich_menu` | リッチメニュー作成（画像アップロード対応） |
| `manage_rich_menus` | リッチメニュー一覧・削除・デフォルト設定 |
| `create_tracked_link` | URLトラッキングリンク作成 |
| `manage_tracked_links` | トラッキングリンク一覧・削除 |
| `get_link_clicks` | リンククリック分析 |
| `upload_image` | R2画像アップロード（公開URL取得） |
| `manage_staff` | スタッフアカウント管理 |
| `manage_ad_platforms` | 広告プラットフォーム連携 |
| `get_conversion_logs` | コンバージョンログ取得 |
| `account_summary` | アカウント概要 |
| `list_crm_objects` | CRMオブジェクト汎用一覧 |
| `auto_track_urls` | URL自動トラッキング |

## 5分デプロイガイド

### 前提条件

- Node.js 20+
- pnpm 9+
- [Cloudflare アカウント](https://dash.cloudflare.com/sign-up)
- [LINE Developers アカウント](https://developers.line.biz/)

### 1. LINE チャネル設定

1. [LINE Developers Console](https://developers.line.biz/console/) でプロバイダーを作成
2. Messaging API チャネルを作成
3. 以下を控えておく:
   - **チャネルシークレット** (Basic settings)
   - **チャネルアクセストークン** (Messaging API → Issue)

### 2. リポジトリのセットアップ

```bash
git clone https://github.com/Shudesu/line-harness.git
cd line-harness
pnpm install
```

### 3. Cloudflare D1 データベース作成

```bash
npx wrangler d1 create line-crm
# 出力される database_id を apps/worker/wrangler.toml に記入

# スキーマを適用
npx wrangler d1 execute line-crm --file=packages/db/schema.sql
```

### 4. Workers のシークレット設定

```bash
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put API_KEY
```

### 5. Workers デプロイ

```bash
pnpm deploy:worker
```

### 6. LINE Webhook 設定

1. LINE Developers Console → Messaging API
2. Webhook URL: `https://your-worker.workers.dev/webhook`
3. Webhook を有効化 → 検証

### 7. 管理画面デプロイ

```bash
cd apps/web
vercel deploy
# 環境変数: NEXT_PUBLIC_API_URL のみ（APIキーはログイン画面で入力）
```

### 8. 動作確認

1. LINE公式アカウントを友だち追加
2. 管理画面で友だちが表示されることを確認
3. テストメッセージを送信

## プロジェクト構成

```
line-harness/
├── apps/
│   ├── web/                # Next.js 管理画面
│   ├── worker/             # Cloudflare Workers API
│   └── liff/               # LIFF アプリ (友だち追加・フォーム・予約)
├── packages/
│   ├── db/                 # D1 スキーマ & クエリ
│   ├── sdk/                # TypeScript SDK (@line-harness/sdk)
│   ├── mcp-server/         # MCP Server (@line-harness/mcp-server)
│   ├── line-sdk/           # LINE Messaging API ラッパー
│   └── shared/             # 共有型定義
└── docs/
    └── wiki/               # ドキュメント (25ページ)
```

## スケーリング

| 友だち数 | コスト目安 |
|----------|-----------|
| ~5,000 | 無料 |
| ~10,000 | D1: $0.75/100万読取, Workers: $5/月 |
| 50,000+ | Queues追加で配信レート制御推奨 |

## ライセンス

MIT
