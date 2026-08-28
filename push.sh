#!/usr/bin/env bash
# Commit local changes and push the current branch to origin.
# Git Bash:
#   cd "$HOME/Downloads/clinicosmg"
#   bash push.sh "Rebuild doctor dashboard"
set -euo pipefail

cd "$(dirname "$0")"

branch="$(git rev-parse --abbrev-ref HEAD)"
msg="${1:-Rebuild doctor clinic dashboard}"

git reset HEAD -- \
  .env \
  .env.local \
  clinicos-api/.env \
  iqpigeon/config.local.php \
  2>/dev/null || true

git add -A
git reset HEAD -- \
  .env \
  .env.local \
  clinicos-api/.env \
  iqpigeon/config.local.php \
  2>/dev/null || true

if git diff --cached --quiet; then
  echo "Nothing to commit. Pushing $branch..."
else
  git commit -m "$msg"
fi

git push -u origin "$branch"
echo "Pushed $branch to origin."
