#!/bin/bash
# Hook: PreToolUse for Write/Edit
# Blocks writing secrets into files that will be synced to OSS
# Checks: CF account IDs, D1 IDs, email addresses, API keys

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.command // ""')
NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // ""')

# Only check files in the line-harness project
if [[ "$FILE_PATH" != *"tools/line-harness"* ]]; then
  exit 0
fi

# Skip memory files and hooks
if [[ "$FILE_PATH" == *"/.claude/"* ]] || [[ "$FILE_PATH" == *"/memory/"* ]]; then
  exit 0
fi

# Files that are excluded from OSS sync — secrets OK here
SAFE_FILES=(".mcp.json" "CLAUDE.md" ".env" ".env.local" ".env.production" ".env.staging")
for safe in "${SAFE_FILES[@]}"; do
  if [[ "$FILE_PATH" == *"$safe" ]]; then
    exit 0
  fi
done

# Check for secrets in the content being written
SECRETS=(
  "37f8f88be4c099329e4647bda211bb9f"
  "c40947ff58a767be74a53be79a89d68a"
  "b2712617-31c4-47c2-accd-4eec906c44ce"
  "7efe7c20-01ae-4d65-be08-0d7b4202e8a1"
  "aiagent.mini@gmail.com"
  "lh_084d968f"
  "lh_e81764015d"
)

for secret in "${SECRETS[@]}"; do
  if echo "$NEW_CONTENT" | grep -q "$secret"; then
    echo "BLOCKED: シークレットが含まれています。OSSに同期されるファイルにシークレットを書かないでください。"
    echo "検出: $secret"
    echo "ファイル: $FILE_PATH"
    echo ""
    echo "CLAUDE.md や .mcp.json 等の除外ファイルにのみ書いてください。"
    exit 2
  fi
done

exit 0
