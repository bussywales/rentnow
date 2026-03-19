#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <slug> <endpoint>"
  exit 64
fi

SLUG="$1"
ENDPOINT="$2"

APP_URL="${APP_URL:-}"
CRON_SECRET="${CRON_SECRET:-}"
ATTEMPTS="${ATTEMPTS:-3}"
SLEEP_SECONDS="${SLEEP_SECONDS:-10}"
CONNECT_TIMEOUT_SECONDS="${CONNECT_TIMEOUT_SECONDS:-10}"
MAX_TIME_SECONDS="${MAX_TIME_SECONDS:-60}"
DEBUG_ROOT="${DEBUG_ROOT:-${GITHUB_WORKSPACE:-$(pwd)}/.cron-debug/payments-reconcile}"

if [ -z "${APP_URL}" ]; then
  echo "Missing required env: APP_URL"
  exit 64
fi

if [ -z "${CRON_SECRET}" ]; then
  echo "Missing required env: CRON_SECRET"
  exit 64
fi

debug_dir="${DEBUG_ROOT%/}/${SLUG}"
mkdir -p "${debug_dir}"

response_body="${debug_dir}/response-body.json"
response_headers="${debug_dir}/response-headers.txt"
curl_verbose="${debug_dir}/curl-verbose.log"
metadata_file="${debug_dir}/metadata.txt"

request_url="${APP_URL%/}${ENDPOINT}"

echo "Endpoint slug: ${SLUG}"
echo "Request URL: ${request_url}"
echo "Attempt budget: ${ATTEMPTS}"

attempt=1
success=0
http_code=""
curl_exit=0
response_ok=1
response_summary="Response validation did not run."

while [ "${attempt}" -le "${ATTEMPTS}" ]; do
  : > "${response_body}"
  : > "${response_headers}"
  : > "${curl_verbose}"

  echo "[${SLUG}] Attempt ${attempt}/${ATTEMPTS}"

  set +e
  http_code="$(curl -sS \
    -o "${response_body}" \
    -D "${response_headers}" \
    -w "%{http_code}" \
    -X POST "${request_url}" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    -H "content-type: application/json" \
    --connect-timeout "${CONNECT_TIMEOUT_SECONDS}" \
    --max-time "${MAX_TIME_SECONDS}" \
    --data '{}' \
    -v 2>"${curl_verbose}")"
  curl_exit=$?
  set -e

  echo "[${SLUG}] HTTP status: ${http_code:-curl_error}"
  echo "[${SLUG}] Response body (first 2048 bytes):"
  head -c 2048 "${response_body}" || true
  echo ""

  response_ok=1
  response_summary="Response validation skipped because curl did not complete successfully."
  if [ "${curl_exit}" -eq 0 ] && [[ "${http_code}" =~ ^[0-9]{3}$ ]]; then
    set +e
    response_summary="$(
      node -e '
        const fs = require("fs");
        const raw = fs.readFileSync(process.argv[1], "utf8");
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch (error) {
          console.error("Response body is not valid JSON.");
          process.exit(1);
        }

        if (!payload || payload.ok !== true) {
          const reason =
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error
              : typeof payload?.reason === "string" && payload.reason.trim()
                ? payload.reason
                : "Endpoint returned ok != true.";
          console.error(reason);
          process.exit(1);
        }

        const summaryParts = Object.entries(payload)
          .filter(([key, value]) => key !== "ok" && key !== "route" && typeof value !== "object")
          .slice(0, 8)
          .map(([key, value]) => `${key}=${String(value)}`);

        process.stdout.write(summaryParts.join(", "));
      ' "${response_body}"
    )"
    response_ok=$?
    set -e
  fi

  if [ "${curl_exit}" -eq 0 ] && [[ "${http_code}" =~ ^2[0-9][0-9]$ ]] && [ "${response_ok}" -eq 0 ]; then
    success=1
    break
  fi

  retry_allowed=0
  if [ "${curl_exit}" -ne 0 ]; then
    retry_allowed=1
  elif [[ "${http_code}" =~ ^5[0-9][0-9]$ ]]; then
    retry_allowed=1
  elif [ "${response_ok}" -ne 0 ] && [[ "${http_code}" =~ ^2[0-9][0-9]$ ]]; then
    retry_allowed=1
  fi

  if [ "${attempt}" -lt "${ATTEMPTS}" ] && [ "${retry_allowed}" -eq 1 ]; then
    echo "[${SLUG}] Retrying in ${SLEEP_SECONDS}s..."
    sleep "${SLEEP_SECONDS}"
  else
    break
  fi

  attempt=$((attempt + 1))
done

{
  echo "slug=${SLUG}"
  echo "endpoint=${ENDPOINT}"
  echo "request_url=${request_url}"
  echo "attempt=${attempt}"
  echo "http_code=${http_code:-curl_error}"
  echo "curl_exit=${curl_exit}"
  echo "response_ok=${response_ok}"
  echo "response_summary=${response_summary}"
} > "${metadata_file}"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### ${SLUG}"
    echo ""
    echo "- URL: \`${request_url}\`"
    echo "- Final HTTP status: \`${http_code:-curl_error}\`"
    echo "- Curl exit: \`${curl_exit}\`"
    echo "- Final attempt: \`${attempt}/${ATTEMPTS}\`"
    echo "- Response summary: \`${response_summary}\`"
    echo ""
  } >> "${GITHUB_STEP_SUMMARY}"
fi

if [ "${success}" -ne 1 ]; then
  echo "::error title=Payments reconcile workflow failure::${SLUG} failed with HTTP ${http_code:-curl_error} (curl exit ${curl_exit}). See uploaded failure artifacts for headers, body, and curl verbose output."
  exit 1
fi

echo "[${SLUG}] Success: ${response_summary}"
