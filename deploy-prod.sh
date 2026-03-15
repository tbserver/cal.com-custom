#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .env.prod ]]; then
  set -a
  . ./.env.prod
  set +a
fi

if [[ $# -eq 0 ]]; then
  set -- up -d --build
fi

doppler run --project calcom --config prd -- docker compose "$@"