#!/usr/bin/env bash
# Motion Marketing Studio - instalare pe macOS / Linux
#   bash install.sh          (cere confirmare înainte să instaleze ceva de sistem)
#   bash install.sh --yes    (instalează Node.js prin Homebrew/apt fără întrebări)
set -euo pipefail
cd "$(dirname "$0")"
YES=0
[[ "${1:-}" == "--yes" ]] && YES=1

step() { printf "\n==> %s\n" "$1"; }
ok() { printf "  [ok] %s\n" "$1"; }
fail() { printf "  [x] %s\n" "$1"; exit 1; }
ask() { [[ $YES == 1 ]] && return 0; read -r -p "$1 [d/N] " a; [[ "$a" =~ ^(d|da|y|yes)$ ]]; }

step "Node.js"
need_node=1
if command -v node >/dev/null 2>&1; then
  ver=$(node --version | sed 's/^v//'); maj=${ver%%.*}; rest=${ver#*.}; min=${rest%%.*}
  if (( maj > 20 || (maj == 20 && min >= 11) )); then need_node=0; ok "Node.js v$ver"; else echo "  Node.js v$ver e prea vechi (minim 20.11)."; fi
fi
if (( need_node )); then
  if command -v brew >/dev/null 2>&1 && ask "Node.js lipsește. Îl instalez cu Homebrew (brew install node)?"; then brew install node
  elif command -v apt-get >/dev/null 2>&1 && ask "Node.js lipsește. Îl instalez cu apt (nodesource LTS)?"; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs
  else fail "Instalează Node.js LTS (https://nodejs.org) și rulează din nou."; fi
fi

step "Dependențe npm (npm ci)"
npm ci --no-audit --no-fund
ok "dependențe instalate"

step "Browsere (randare + captură)"
npx remotion browser ensure
npx playwright install chromium
if [[ "$(uname)" == "Linux" ]]; then
  echo "  Pe Linux, Chromium poate cere biblioteci de sistem. Dacă randarea eșuează: npx playwright install-deps chromium"
fi

step "Configurare"
[[ -f .env ]] || { cp .env.example .env; ok ".env creat din .env.example"; }
npx tsx scripts/setup.ts

step "Verificare"
npx tsx scripts/doctor.ts
printf "\nGata. Pornește Studio-ul cu:\n  npm run studio\n"
