#!/usr/bin/env bash
# Installs the newest CI iOS development build for a branch on a USB-connected iPhone.
# Needs gh (signed in), gpg holding the "Astral Grove iOS dev builds" private key, and ideviceinstaller.
set -euo pipefail

branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"
run=$(gh run list --workflow ios-dev-build.yml --branch "$branch" --status success \
  --limit 1 --json databaseId -q '.[0].databaseId')
if [ -z "$run" ]; then
  echo "No successful iOS development build for $branch." >&2
  exit 1
fi

dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
echo "Downloading run $run for $branch…"
gh run download "$run" --name ios-dev-build --dir "$dir"
gpg --batch --quiet --decrypt --output "$dir/astral-grove.ipa" "$dir/astral-grove.ipa.gpg"
ideviceinstaller install "$dir/astral-grove.ipa"
