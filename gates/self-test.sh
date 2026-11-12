#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."
node --test tests/prose-policy.test.mjs tests/prose-guard.test.mjs tests/event-guard.test.mjs
