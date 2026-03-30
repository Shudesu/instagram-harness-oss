# LINE OSS CRM MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully deployable LINE Official Account CRM with friend management, step delivery, broadcast, and admin dashboard.

**Architecture:** pnpm monorepo with Cloudflare Workers (Hono) for API/webhook, Next.js 15 for admin UI, D1 for storage. All LINE API calls go through a typed SDK wrapper. Admin UI calls Workers API which manages D1.

**Tech Stack:** TypeScript, pnpm, Hono, Cloudflare Workers/D1/Queues/Cron, Next.js 15 (App Router), Tailwind CSS, LINE Messaging API

---

## File Structure

```
line-oss-crm/
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── wrangler.toml
├── apps/
│   ├── worker/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── wrangler.toml
│   │   └── src/
│   │       ├── index.ts            # Hono app entry + cron handler
│   │       ├── routes/
│   │       │   ├── webhook.ts      # LINE webhook handler
│   │       │   ├── friends.ts      # Friend CRUD API
│   │       │   ├── tags.ts         # Tag CRUD API
│   │       │   ├── scenarios.ts    # Scenario CRUD API
│   │       │   └── broadcasts.ts   # Broadcast API
│   │       ├── services/
│   │       │   ├── step-delivery.ts # Step delivery cron logic
│   │       │   └── broadcast.ts    # Broadcast send logic
│   │       └── middleware/
│   │           └── auth.ts         # API key auth middleware
│   └── web/
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx        # Dashboard home
│           │   ├── friends/
│           │   │   └── page.tsx    # Friend list + tags
│           │   ├── scenarios/
│           │   │   ├── page.tsx    # Scenario list
│           │   │   └── [id]/
│           │   │       └── page.tsx # Scenario builder
│           │   └── broadcasts/
│           │       └── page.tsx    # Broadcast compose + list
│           ├── components/
│           │   ├── layout/
│           │   │   ├── sidebar.tsx
│           │   │   └── header.tsx
│           │   ├── friends/
│           │   │   ├── friend-table.tsx
│           │   │   └── tag-badge.tsx
│           │   ├── scenarios/
│           │   │   ├── scenario-list.tsx
│           │   │   └── step-editor.tsx
│           │   └── broadcasts/
│           │       └── broadcast-form.tsx
│           └── lib/
│               └── api.ts          # API client for Workers
├── packages/
│   ├── db/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── schema.sql              # D1 schema
│   │   └── src/
│   │       ├── index.ts            # Query helpers export
│   │       ├── friends.ts          # Friend queries
│   │       ├── tags.ts             # Tag queries
│   │       ├── scenarios.ts        # Scenario queries
│   │       └── broadcasts.ts       # Broadcast queries
│   ├── line-sdk/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Export all
│   │       ├── client.ts           # LINE API client
│   │       ├── types.ts            # LINE API types
│   │       └── webhook.ts          # Signature verification
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           └── types.ts            # Shared types across packages
```

## Tasks

### Task 1: Monorepo Root Setup
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`

### Task 2: packages/shared
- Create: Shared TypeScript types for all packages

### Task 3: packages/db
- Create: D1 schema SQL, typed query helpers for all tables

### Task 4: packages/line-sdk
- Create: Typed LINE Messaging API client, webhook signature verification

### Task 5: apps/worker
- Create: Hono app with webhook handler, CRUD APIs, cron handler, auth middleware

### Task 6: apps/web
- Create: Next.js 15 admin dashboard with friends, scenarios, broadcasts pages

### Task 7: Config & Docs
- Create: `wrangler.toml`, `README.md` with deploy guide
