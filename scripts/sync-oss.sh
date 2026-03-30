#!/bin/bash
# Sync private repo to OSS repo
# Usage: bash scripts/sync-oss.sh

OSS_DIR="/tmp/line-harness-public"
PRIVATE_DIR="/Users/axpr/claudecode/tools/line-harness"

echo "=== Syncing to OSS ==="

# Rsync with exclusions
rsync -av --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env.production' \
  --exclude='.env.local' \
  --exclude='.env' \
  --exclude='.claude' \
  --exclude='.githooks' \
  --exclude='apps/web/out' \
  --exclude='apps/worker/dist' \
  --exclude='docs/superpowers' \
  --exclude='README.md' \
  --exclude='.github/workflows' \
  --exclude='CHANGELOG.md' \
  --exclude='COMPETITOR_FEATURES.md' \
  --exclude='PROGRESS.md' \
  --exclude='SPEC.md' \
  --exclude='.env.example' \
  --exclude='tsconfig.base.json' \
  --exclude='CLAUDE.md' \
  --exclude='.mcp.json' \
  --exclude='*.toml.bak' \
  "$PRIVATE_DIR/" "$OSS_DIR/"

# Clean secrets
cd "$OSS_DIR"
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.toml" -o -name "*.sql" -o -name "*.sh" -o -name "*.json" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i '' \
    -e 's|b2712617-31c4-47c2-accd-4eec906c44ce|YOUR_D1_DATABASE_ID|g' \
    -e 's|b2712617[^"]*"|YOUR_D1_DATABASE_ID"|g' \
    -e 's|37f8f88be4c099329e4647bda211bb9f|YOUR_ACCOUNT_ID|g' \
    -e 's|c40947ff58a767be74a53be79a89d68a|YOUR_DEV_ACCOUNT_ID|g' \
    -e 's|7efe7c20-01ae-4d65-be08-0d7b4202e8a1|YOUR_DEV_D1_DATABASE_ID|g' \
    -e 's|aiagent\.mini@gmail\.com|your-email@example.com|g' \
    {} +

# Verify no secrets
LEAKS=$(grep -rl "b2712617\|4ed0681\|98ca4e0c\|3723bd16\|37f8f88be4c0\|c40947ff58a7\|aiagent\.mini@gmail" . 2>/dev/null | grep -v node_modules | grep -v ".git/")
if [ -n "$LEAKS" ]; then
  echo "WARNING: secrets found in:"
  echo "$LEAKS"
  exit 1
fi

echo "=== Clean. Ready to commit ==="
git add -A
git status --short
