#!/usr/bin/env bash
# AETHER AI — GitHub App configuration verifier
#
# Proves that a GitHub App ID + private key are valid, that the App is installed,
# and that its permissions can reach the workspace repository.
#
# It never prints the private key, the JWT, or any token.
#
# Usage:
#   export GH_APP_ID="1234567"
#   export GH_APP_PRIVATE_KEY_PATH="/secure/aether-app.private-key.pem"
#   export GH_WORKSPACE_REPO="owner/repo"      # optional, adds a Contents check
#   bash docs/setup/verify-github-app.sh

set -euo pipefail

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
die()  { red "ERROR: $*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }
need openssl
need curl
need python3

[ -n "${GH_APP_ID:-}" ] || die "GH_APP_ID is not set"
[ -n "${GH_APP_PRIVATE_KEY_PATH:-}" ] || die "GH_APP_PRIVATE_KEY_PATH is not set"
[ -f "$GH_APP_PRIVATE_KEY_PATH" ] || die "private key not found at $GH_APP_PRIVATE_KEY_PATH"

case "$GH_APP_ID" in
  *[!0-9]*) die "GH_APP_ID must be numeric" ;;
esac

perms=$(stat -c '%a' "$GH_APP_PRIVATE_KEY_PATH" 2>/dev/null || echo "unknown")
if [ "$perms" != "600" ] && [ "$perms" != "400" ]; then
  ylw "WARNING: private key permissions are $perms; expected 600. Run: chmod 600 <file>"
fi

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

now=$(date +%s)
iat=$((now - 60))
exp=$((now + 540))
header='{"alg":"RS256","typ":"JWT"}'
payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$iat" "$exp" "$GH_APP_ID")

h=$(printf '%s' "$header" | b64url)
p=$(printf '%s' "$payload" | b64url)
signing_input="$h.$p"
sig=$(printf '%s' "$signing_input" | openssl dgst -sha256 -sign "$GH_APP_PRIVATE_KEY_PATH" | b64url)
jwt="$signing_input.$sig"

api() { curl -sS -o /tmp/aether_gh_resp.json -w '%{http_code}' -H "Accept: application/vnd.github+json" \
         -H "Authorization: Bearer $1" -H "X-GitHub-Api-Version: 2022-11-28" "$2"; }

pyval() { python3 -c "import json,sys;d=json.load(open('/tmp/aether_gh_resp.json'));print($1)" 2>/dev/null || true; }

echo "→ Verifying App identity…"
code=$(api "$jwt" "https://api.github.com/app")
case "$code" in
  200)
    slug=$(pyval "d.get('slug','?')")
    name=$(pyval "d.get('name','?')")
    grn "App identity: $name ($slug) — App ID and private key match."
    ;;
  401) die "GitHub rejected the credentials (401). App ID and private key do not match, or the key was revoked." ;;
  404) die "App not found (404). Check GH_APP_ID." ;;
  *)   die "Unexpected response from GitHub: HTTP $code" ;;
esac

echo "→ Listing installations…"
code=$(api "$jwt" "https://api.github.com/app/installations")
if [ "$code" != "200" ]; then
  die "Could not list installations (HTTP $code)."
fi
count=$(pyval "len(d)")
if [ "${count:-0}" -eq 0 ]; then
  ylw "No installations found. Install the App and select your workspace repository."
  exit 0
fi
python3 - <<'PY'
import json
d = json.load(open('/tmp/aether_gh_resp.json'))
for i in d:
    acct = (i.get('account') or {}).get('login', '?')
    sel = i.get('repository_selection', '?')
    print(f"   installation {i.get('id')} → {acct} ({sel} repositories)")
PY

inst_id=$(python3 -c "import json;d=json.load(open('/tmp/aether_gh_resp.json'));print(d[0]['id'])")
echo "→ Minting an installation token (value is never printed)…"
# Minting requires POST
code=$(curl -sS -o /tmp/aether_gh_token.json -w '%{http_code}' -X POST \
  -H "Accept: application/vnd.github+json" -H "Authorization: Bearer $jwt" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/app/installations/$inst_id/access_tokens")
if [ "$code" = "201" ]; then
  grn "Installation token: minted (expires in 60 minutes)."
  token=$(python3 -c "import json;print(json.load(open('/tmp/aether_gh_token.json')).get('token',''))")
else
  die "Could not mint an installation token (HTTP $code)."
fi

if [ -n "${GH_WORKSPACE_REPO:-}" ]; then
  echo "→ Checking repository access…"
  code=$(curl -sS -o /tmp/aether_gh_repo.json -w '%{http_code}' \
    -H "Accept: application/vnd.github+json" -H "Authorization: Bearer $token" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$GH_WORKSPACE_REPO")
  if [ "$code" = "200" ]; then
    perm=$(python3 -c "import json;d=json.load(open('/tmp/aether_gh_repo.json'));print(d.get('permissions',{}))")
    grn "Repository access: $GH_WORKSPACE_REPO (permissions: $perm)"
  else
    ylw "Repository check returned HTTP $code. Is the App installed on that repository?"
  fi
fi

# Clean up anything containing sensitive material.
unset jwt token sig
rm -f /tmp/aether_gh_token.json /tmp/aether_gh_resp.json /tmp/aether_gh_repo.json
grn "Configuration verified. No secret was printed or stored by this script."
