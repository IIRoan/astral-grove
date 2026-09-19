#!/usr/bin/env bash
# Installs a PR's iOS development build on a USB-connected iPhone, for when the QR install is not an option.
# Needs gh (signed in) and ideviceinstaller. Defaults to the PR of the current branch.
set -euo pipefail

pr=$(gh pr view ${1:+"$1"} --json number -q .number)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
gh release download "pr-$pr" --pattern astral-grove.ipa --dir "$dir"
ideviceinstaller install "$dir/astral-grove.ipa"
