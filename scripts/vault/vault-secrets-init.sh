#!/bin/sh
set -eu

require_var() {
  var_name="$1"
  eval var_value="\${$var_name:-}"
  if [ -z "$var_value" ]; then
    echo "vault-secrets-init: required variable $var_name is missing" >&2
    exit 1
  fi
}

require_var VAULT_ADDR
require_var VAULT_WRAPPED_SECRET_ID

CURL_TLS_ARGS=""
if [ "${VAULT_SKIP_TLS_VERIFY:-false}" = "true" ]; then
  CURL_TLS_ARGS="-k"
fi

vault_curl() {
  method="$1"
  endpoint="$2"
  token="$3"
  body="${4:-}"
  url="${VAULT_ADDR%/}/v1/${endpoint#'/'}"

  if [ -n "$body" ]; then
    if [ -n "$token" ]; then
      curl -sS $CURL_TLS_ARGS -X "$method" \
        -H "X-Vault-Token: $token" \
        -H "Content-Type: application/json" \
        --data "$body" \
        "$url"
    else
      curl -sS $CURL_TLS_ARGS -X "$method" \
        -H "Content-Type: application/json" \
        --data "$body" \
        "$url"
    fi
  else
    if [ -n "$token" ]; then
      curl -sS $CURL_TLS_ARGS -X "$method" \
        -H "X-Vault-Token: $token" \
        "$url"
    else
      curl -sS $CURL_TLS_ARGS -X "$method" "$url"
    fi
  fi
}

lookup_response="$(vault_curl POST sys/wrapping/lookup "$VAULT_WRAPPED_SECRET_ID" "{}")"
lookup_error="$(printf '%s' "$lookup_response" | sed -n 's/.*"errors":\["\([^"]*\)"\].*/\1/p')"
lookup_creation_path="$(printf '%s' "$lookup_response" | sed -n 's/.*"creation_path":"\([^"]*\)".*/\1/p')"

if [ -n "$lookup_error" ]; then
  echo "vault-secrets-init: wrapping lookup failed: $lookup_error" >&2
  exit 1
fi

if [ -n "${VAULT_EXPECTED_WRAP_CREATION_PATH:-}" ] && [ "$lookup_creation_path" != "$VAULT_EXPECTED_WRAP_CREATION_PATH" ]; then
  echo "vault-secrets-init: wrapped token creation path mismatch. expected='${VAULT_EXPECTED_WRAP_CREATION_PATH}' actual='${lookup_creation_path}'" >&2
  exit 1
fi

unwrap_response="$(vault_curl POST sys/wrapping/unwrap "$VAULT_WRAPPED_SECRET_ID" "{}")"
unwrap_error="$(printf '%s' "$unwrap_response" | sed -n 's/.*"errors":\["\([^"]*\)"\].*/\1/p')"
client_token="$(printf '%s' "$unwrap_response" | sed -n 's/.*"client_token":"\([^"]*\)".*/\1/p')"

if [ -n "$unwrap_error" ]; then
  echo "vault-secrets-init: unwrap failed: $unwrap_error" >&2
  exit 1
fi

if [ -z "$client_token" ]; then
  echo "vault-secrets-init: unwrap did not return a client_token" >&2
  exit 1
fi

umask 077
secret_dir="${VAULT_SHARED_RUNTIME_DIR:-/vault-runtime}"
mkdir -p "$secret_dir"
printf '%s' "$client_token" > "${VAULT_SHARED_CLIENT_TOKEN_FILE:-/vault-runtime/client_token}"
chmod 0755 "$secret_dir"
chmod 0444 "${VAULT_SHARED_CLIENT_TOKEN_FILE:-/vault-runtime/client_token}"

echo "vault-secrets-init: wrote shared client token file"
