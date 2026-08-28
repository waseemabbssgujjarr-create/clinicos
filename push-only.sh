#!/usr/bin/env bash
# Push the current branch to origin (no commit).
# Git Bash:
#   cd "$HOME/Downloads/clinicosmg"
#   bash push-only.sh
set -euo pipefail

cd "$(dirname "$0")"

branch="$(git rev-parse --abbrev-ref HEAD)"
git push -u origin "$branch"
echo "Pushed $branch to origin."
