#!/bin/sh
# chain.sh bootstrap — install the chain tools from their latest releases.
#
#   curl -fsSL https://chain.sh/bootstrap.sh | sh
#
# Or read it first and run it yourself; that is the point of it being a
# plain shell script:
#
#   curl -fsSLO https://chain.sh/bootstrap.sh && sh bootstrap.sh
#
# What it does, and nothing else:
#
#   1. Detects your OS and CPU architecture.
#   2. For ketch, cymbal and recoil: asks GitHub for the latest release, picks
#      the archive built for this machine, downloads it together with the
#      release's checksums.txt, and refuses to install anything whose SHA-256
#      does not match.
#   3. Installs each binary to /usr/local/bin if that is writable, otherwise
#      to ~/.local/bin. Never uses sudo. Never half-overwrites a binary that
#      is running — the new file is written beside the old one and moved into
#      place in one step.
#   4. brainfile ships on npm, not as a binary, so it is installed with
#      `npm install -g brainfile` when npm is available and skipped with a
#      message when it is not.
#
# It does not touch your shell profile, does not read or write any tool's
# data, and does not run any of the tools it installs.
#
# Options:
#   --bin-dir DIR      install binaries here instead of the default
#   --only a,b         install only these tools
#   --skip a,b         skip these tools
#   --dry-run          show what would happen; download and install nothing
#   -h, --help         this text
#
# Environment:
#   GITHUB_TOKEN       used for the GitHub API if set, to avoid rate limits

set -eu

TOOLS="ketch cymbal recoil brainfile"
OWNER="1broseidon"
BIN_DIR=""
ONLY=""
SKIP=""
DRY_RUN=0

# ---------------------------------------------------------------- helpers --

say()  { printf '%s\n' "$*"; }
warn() { printf 'bootstrap: %s\n' "$*" >&2; }
die()  { warn "$*"; exit 1; }

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

has() { command -v "$1" >/dev/null 2>&1; }

# Is $1 in the space-separated list $2?
in_list() {
  case " $2 " in *" $1 "*) return 0 ;; *) return 1 ;; esac
}

# ---------------------------------------------------------------- options --

while [ $# -gt 0 ]; do
  case "$1" in
    --bin-dir) BIN_DIR="$2"; shift 2 ;;
    --bin-dir=*) BIN_DIR="${1#*=}"; shift ;;
    --only) ONLY="$(printf '%s' "$2" | tr ',' ' ')"; shift 2 ;;
    --only=*) ONLY="$(printf '%s' "${1#*=}" | tr ',' ' ')"; shift ;;
    --skip) SKIP="$(printf '%s' "$2" | tr ',' ' ')"; shift 2 ;;
    --skip=*) SKIP="$(printf '%s' "${1#*=}" | tr ',' ' ')"; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

for t in $ONLY $SKIP; do
  in_list "$t" "$TOOLS" || die "unknown tool: $t (known: $TOOLS)"
done

# --------------------------------------------------------------- platform --

case "$(uname -s)" in
  Darwin) OS=darwin ;;
  Linux)  OS=linux ;;
  *) die "unsupported OS: $(uname -s). On Windows use each tool's install.ps1." ;;
esac

case "$(uname -m)" in
  x86_64|amd64)  ARCH=x86_64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) die "unsupported architecture: $(uname -m)" ;;
esac

# ------------------------------------------------------------- prerequisites --

if has curl; then
  fetch() { curl -fsSL "$@"; }
  fetch_api() {
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" "$1"
    else
      curl -fsSL "$1"
    fi
  }
elif has wget; then
  fetch() { wget -qO- "$@"; }
  fetch_api() {
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      wget -qO- --header="Authorization: Bearer $GITHUB_TOKEN" "$1"
    else
      wget -qO- "$1"
    fi
  }
else
  die "need curl or wget"
fi

# Refuse to install anything we cannot verify. There is no --no-verify.
if has sha256sum; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
elif has shasum; then
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  die "need sha256sum or shasum to verify downloads"
fi

# ---------------------------------------------------------------- bin dir --

if [ -z "$BIN_DIR" ]; then
  if [ -w /usr/local/bin ]; then
    BIN_DIR=/usr/local/bin
  else
    BIN_DIR="$HOME/.local/bin"
  fi
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

# ------------------------------------------------------------- one binary --

# Install one tool from its latest GitHub release. Returns 0 on success,
# 2 if there is no release to install from, 1 on any other failure.
install_binary() {
  tool="$1"
  api="https://api.github.com/repos/$OWNER/$tool/releases/latest"

  if ! release="$(fetch_api "$api" 2>/dev/null)"; then
    return 2
  fi

  tag="$(printf '%s' "$release" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
  [ -n "$tag" ] || return 2

  # Match the asset by its platform suffix rather than templating the name:
  # ketch publishes ketch_0.17.1_darwin_arm64.tar.gz and cymbal publishes
  # cymbal_v0.15.0_darwin_arm64.tar.gz, and this must not care which.
  url="$(printf '%s' "$release" \
    | grep -o '"browser_download_url": *"[^"]*"' \
    | cut -d'"' -f4 \
    | grep "_${OS}_${ARCH}\.tar\.gz$" \
    | head -1)"
  if [ -z "$url" ]; then
    warn "$tool $tag has no build for ${OS}/${ARCH}"
    return 1
  fi
  asset="${url##*/}"
  sums_url="${url%/*}/checksums.txt"

  if [ "$DRY_RUN" -eq 1 ]; then
    say "  would install $tool $tag from $asset -> $BIN_DIR/$tool"
    return 0
  fi

  fetch "$url" > "$TMP/$asset"
  fetch "$sums_url" > "$TMP/$tool.checksums.txt"

  expected="$(grep " \*\{0,1\}$asset\$" "$TMP/$tool.checksums.txt" | head -1 | cut -d' ' -f1)"
  if [ -z "$expected" ]; then
    warn "$tool: checksums.txt does not list $asset — not installing"
    return 1
  fi
  actual="$(sha256 "$TMP/$asset")"
  if [ "$actual" != "$expected" ]; then
    warn "$tool: checksum mismatch for $asset"
    warn "  expected $expected"
    warn "  actual   $actual"
    return 1
  fi

  mkdir -p "$TMP/$tool"
  tar xzf "$TMP/$asset" -C "$TMP/$tool"
  bin="$(find "$TMP/$tool" -type f -name "$tool" | head -1)"
  if [ -z "$bin" ]; then
    warn "$tool: archive $asset contains no '$tool' binary"
    return 1
  fi

  mkdir -p "$BIN_DIR"
  # Write beside the target, then rename: one step, and a running copy keeps
  # its old inode.
  staged="$BIN_DIR/.$tool.bootstrap.$$"
  cp "$bin" "$staged"
  chmod 755 "$staged"
  mv -f "$staged" "$BIN_DIR/$tool"

  say "  $tool $tag -> $BIN_DIR/$tool"
  return 0
}

# --------------------------------------------------------------- brainfile --

install_brainfile() {
  if ! has npm; then
    warn "brainfile ships on npm and npm is not installed — skipping."
    warn "  install Node.js, then: npm install -g brainfile"
    return 2
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    say "  would run: npm install -g brainfile"
    return 0
  fi
  if npm install -g brainfile >"$TMP/npm.log" 2>&1; then
    say "  brainfile $(brainfile --version 2>/dev/null || echo '(installed)') via npm"
    return 0
  fi
  warn "brainfile: npm install failed:"
  sed 's/^/    /' "$TMP/npm.log" >&2
  return 1
}

# -------------------------------------------------------------------- run --

say "chain.sh bootstrap · ${OS}/${ARCH} · binaries -> $BIN_DIR"
[ "$DRY_RUN" -eq 1 ] && say "(dry run: nothing will be downloaded or installed)"
say ""

installed=""
skipped=""
failed=""

for tool in $TOOLS; do
  if [ -n "$ONLY" ] && ! in_list "$tool" "$ONLY"; then continue; fi
  if in_list "$tool" "$SKIP"; then continue; fi

  # `set -e` would exit on a non-zero return here; the `|| rc=$?` form keeps
  # the status without triggering it, so one tool failing cannot abort the rest.
  rc=0
  if [ "$tool" = brainfile ]; then
    install_brainfile || rc=$?
  else
    install_binary "$tool" || rc=$?
  fi

  case $rc in
    0) installed="$installed $tool" ;;
    2) skipped="$skipped $tool"
       [ "$tool" = brainfile ] || warn "$tool: no release published yet — skipping" ;;
    *) failed="$failed $tool" ;;
  esac
done

say ""
[ -n "$installed" ] && say "installed:$installed"
[ -n "$skipped" ]   && say "skipped:  $skipped"
[ -n "$failed" ]    && say "failed:   $failed"

if [ -n "$installed" ]; then
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) say ""
       say "$BIN_DIR is not on your PATH. Add it, for example:"
       say "  export PATH=\"$BIN_DIR:\$PATH\"" ;;
  esac
fi

if [ "$DRY_RUN" -eq 0 ] && [ -n "$installed" ]; then
  say ""
  say "Each tool has a first-run step in a repo — installed is not the same as ready:"
  in_list cymbal    "$installed" && say "  cymbal index .     build the symbol index"
  in_list recoil    "$installed" && say "  recoil setup       bootstrap project memory"
  in_list brainfile "$installed" && say "  brainfile init     create .brainfile/brainfile.md"
fi

[ -z "$failed" ]
