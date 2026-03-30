# Changelog

## v0.7.0 (2026-03-29)

### New Features
- **R2 Image Hosting** — 画像アップロード・公開URL配信（`upload_image` ツール）
- **Image Message Type** — `send_message` で画像メッセージ送信対応
- **Friends Text Search** — `list_friends` に名前検索（`search`パラメータ）追加
- **Metadata Filter** — `list_friends` にメタデータフィルタ（`metadataFilter`パラメータ）追加
- **Rich Menu Image Upload** — `create_rich_menu` で画像アップロードまで一括対応
- **Full CRUD MCP Tools** — 全リソースの管理ツール追加:
  - `manage_friends` (count, setMetadata, setRichMenu, removeRichMenu)
  - `manage_tags` に list/delete アクション追加
  - `manage_scenarios` (list, get, update, delete, step CRUD)
  - `manage_broadcasts` (list, get, create_draft, update, send, send_to_segment)
  - `manage_rich_menus` (list, delete, set_default)
  - `manage_forms` (list, get, update, delete)
  - `manage_tracked_links` (list, delete)

### Versions
- `@line-harness/sdk` → 0.2.6
- `@line-harness/mcp-server` → 0.7.2

## v0.5.0 (2026-03-27)

### New Features
- **Staff management** — owner / admin / staff の3ロール権限管理
  - APIキーごとにロールを紐づけ、権限外の操作は403で拒否
  - `GET /api/staff/me` で現在のユーザー情報を取得
  - `POST /api/staff` でスタッフ作成（APIキー自動生成）
  - `PATCH /api/staff/:id` でロール変更・無効化
  - `POST /api/staff/:id/regenerate-key` でAPIキー再発行
  - 管理画面にスタッフ管理ページ追加
  - サイドバーにロール表示・ロール別メニュー表示
- **MCP: `manage_staff` tool** — スタッフのCRUD操作をClaude Codeから実行
- **SDK: `StaffResource`** — `client.staff.list()` / `create()` / `update()` / `delete()` / `me()` / `regenerateKey()`
- **SDK: `HttpClient.patch()`** — PATCH メソッド対応

### Security
- LINE アカウント詳細の秘密情報（channelAccessToken, channelSecret）はstaffロールに非表示
- `line_accounts` の作成・更新・削除はownerのみ

### Upgrade
```bash
wrangler d1 execute line-crm --file=packages/db/migrations/011_staff_members.sql --remote
```

### Package Versions
- `@line-harness/sdk` → 0.2.0
- `@line-harness/mcp-server` → 0.6.0

## v0.2.0 (2026-03-25)

### Breaking Changes
- **DB Schema**: `line_account_id` column added to `friends`, `scenarios`, `broadcasts`, `reminders`, `automations`, `chats`
- **DB Schema**: `login_channel_id`, `login_channel_secret`, `liff_id` columns added to `line_accounts`
- **Timestamps**: All timestamps standardized to JST (+09:00). Existing UTC data is compatible via epoch comparison.

### Upgrade
```bash
wrangler d1 execute line-crm --file=packages/db/migrations/008_multi_account.sql --remote
```

### New Features
- **Multi-account support** — Webhook routing, cron delivery, and admin UI per LINE account
- **Account switcher UI** — Global dropdown in sidebar, all pages filter by selected account
- **Cross-provider UUID linking** — `?uid=` param in `/auth/line` for automatic identity linking across providers
- **Template variable expansion** — `{{name}}`, `{{uid}}`, `{{auth_url:CHANNEL_ID}}` in scenario messages
- **Delivery window** — 9:00-23:00 JST enforcement, per-user preferred hour via "配信時間はN時"
- **replyMessage for welcome** — First step (delay=0) uses free replyMessage instead of pushMessage
- **Bot profile in admin** — Account cards show LINE profile picture, display name, basic ID
- **Account stats** — Per-account friend count, active scenarios, monthly message count
- **GitHub Actions CI/CD** — Auto-deploy Worker on push to main
- **OAuth direct redirect** — `/auth/line` redirects to LINE Login OAuth directly (no LIFF needed)
- **Friend-add redirect** — After OAuth callback, auto-redirect to `line.me/R/ti/p/{basicId}`

### Bug Fixes
- JST timestamp standardization (was UTC, causing wrong delivery times)
- Auth unification (affiliates page + login fallback URL)
- Calendar slot time calculation (was offset by 9 hours)
- ID token verification using correct login channel for multi-account

## v0.1.0 (2026-03-22)

### Initial Release
- Step delivery (scenarios with delay_minutes timing)
- Broadcasts (scheduled, segmented, batch sending)
- Tag-based segmentation
- Rich menu management
- Forms & LIFF
- Tracked links
- Reminders
- Lead scoring
- IF-THEN automation engine
- Webhooks (incoming/outgoing) + notifications
- Operator chat + auto-reply
- Conversion tracking + affiliate system
- Multi-account tables (line_accounts)
- TypeScript SDK (41 tests)
- OpenAPI/Swagger docs
- Admin panel (Next.js 15)
