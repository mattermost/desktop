#!/usr/bin/env bash
# Runs a Mattermost server from its Docker image inside the Cloud Agent VM, for E2E runs that need a
# server of a given version, and seeds it the way Matterwick seeds desktop's CI servers
# (matterwick server/e2e_tests.go): a system admin, team "ad-1" with the admin in it, the same
# MM_* settings, plus one normal user. No Mattermost source checkout is needed: only the image.
#
#   bash .cursor/scripts/cloud-agent-mm-server.sh up      # start (or reuse) and seed; prints the env file path
#   bash .cursor/scripts/cloud-agent-mm-server.sh status  # exit 0 when the server answers and the admin can log in
#   bash .cursor/scripts/cloud-agent-mm-server.sh down    # remove the containers and network (all data is lost)
#
# Inputs (environment):
#   MM_SERVER_VERSION  server version to run, e.g. 12.1.0-rc3 (image mattermost/mattermost-enterprise-edition:<version>)
#   MM_SERVER_IMAGE    full image reference; overrides MM_SERVER_VERSION
#   MM_LICENSE         Enterprise license; passed to the server by name, never printed. CI's servers are
#                      licensed (license-gated specs such as mattermost/bookmarks.test.ts run there), so
#                      without it those specs skip here.
#   MM_PORT            host port, default 8065 (bound to 127.0.0.1 only)
#
# Output: ~/.cloud-agent-mm-server-env, to `source` before running specs. It sets MM_TEST_SERVER_URL,
# MM_TEST_USER_NAME and MM_TEST_PASSWORD (the admin, as CI passes it) and MM_TEST_REGULAR_USER_NAME /
# MM_TEST_REGULAR_USER_PASSWORD. These are throwaway credentials of a local, ephemeral server.
set -Eeuo pipefail

log() { printf '[mm-server] %s\n' "$*" >&2; }
die() { log "$*"; exit 1; }

NETWORK=mm-e2e
DB=mm-e2e-postgres
APP=mm-e2e-server
DB_IMAGE=postgres:15-alpine
MM_PORT="${MM_PORT:-8065}"
URL="http://localhost:${MM_PORT}"
ENV_FILE="${HOME}/.cloud-agent-mm-server-env"

ADMIN_USERNAME=sysadmin
ADMIN_PASSWORD='Sys@dmin-sample1'
ADMIN_EMAIL=sysadmin@sample.mattermost.com
USER_USERNAME=user-1
USER_PASSWORD='SampleUs@r-1'
USER_EMAIL=user-1@sample.mattermost.com
TEAM_NAME=ad-1

# The settings Matterwick gives desktop's E2E servers, plus the site URL and public links that the
# desktop E2E setup (global-setup.ts, `npm run enable-public-links`) would otherwise patch in.
SERVER_ENV=(
  MM_SERVICESETTINGS_SITEURL="${URL}"
  MM_SERVICESETTINGS_ENABLETUTORIAL=false
  MM_SERVICESETTINGS_ENABLEONBOARDINGFLOW=false
  MM_SERVICESETTINGS_ENABLEUSERTYPINGMESSAGES=false
  MM_SERVICESETTINGS_SESSIONLENGTHMOBILEINHOURS=5000
  MM_SERVICESETTINGS_SESSIONCACHEINMINUTES=180
  MM_SERVICEENVIRONMENT=test
  MM_RATELIMITSETTINGS_ENABLE=true
  MM_RATELIMITSETTINGS_PERSEC=3000
  MM_RATELIMITSETTINGS_MAXBURST=5000
  MM_RATELIMITSETTINGS_MEMORYSTORESIZE=10000
  MM_RATELIMITSETTINGS_VARYBYREMOTEADDR=false
  MM_RATELIMITSETTINGS_VARYBYUSER=false
  MM_TEAMSETTINGS_EXPERIMENTALENABLEAUTOMATICREPLIES=true
  MM_FILESETTINGS_ENABLEPUBLICLINK=true
)

image() {
  if [ -n "${MM_SERVER_IMAGE:-}" ]; then
    printf '%s' "${MM_SERVER_IMAGE}"
  elif [ -n "${MM_SERVER_VERSION:-}" ]; then
    printf 'mattermost/mattermost-enterprise-edition:%s' "${MM_SERVER_VERSION}"
  else
    die "Set MM_SERVER_VERSION (for example 12.1.0-rc3) or MM_SERVER_IMAGE."
  fi
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker CLI is missing; the Cloud Agent image did not build from .cursor/Dockerfile."
  docker info >/dev/null 2>&1 || die "Docker daemon is not running; run bash .cursor/scripts/cloud-agent-docker.sh first."
}

# GET or POST against the server. Prints the body; fails on a non-2xx status. Never logs request bodies.
api() {
  local method=$1 path=$2 body=${3:-} token=${4:-}
  local args=(-sS --max-time 30 -X "$method" -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' -w '\n%{http_code}')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  [ -n "$body" ] && args+=(--data-binary "$body")
  local out code
  out=$(curl "${args[@]}" "${URL}/api/v4${path}") || return 1
  code=${out##*$'\n'}
  out=${out%$'\n'*}
  printf '%s' "$out"
  [[ "$code" == 2* ]]
}

server_ready() {
  local body
  body=$(api GET '/system/ping?get_server_status=true' 2>/dev/null) || return 1
  [ "$(jq -r '.status // empty' <<<"$body" 2>/dev/null)" = OK ]
}

wait_for() {
  local what=$1 seconds=$2; shift 2
  for _ in $(seq "$seconds"); do
    "$@" && return 0
    sleep 1
  done
  log "$what did not become ready within ${seconds}s."
  return 1
}

# Over TCP: during first-start initialisation the image's temporary server answers on the socket only.
db_ready() { docker exec "$DB" pg_isready -h 127.0.0.1 -U mmuser -d mattermost_test >/dev/null 2>&1; }

down() {
  docker rm -f "$APP" "$DB" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -f "$ENV_FILE"
  log "Removed ${APP}, ${DB} and network ${NETWORK}."
}

start() {
  local img=$1
  if [ "$(docker inspect -f '{{.Config.Image}} {{.State.Running}}' "$APP" 2>/dev/null)" = "${img} true" ] && server_ready; then
    log "Reusing running ${APP} (${img})."
    return 0
  fi
  down
  log "Pulling ${img} and ${DB_IMAGE}."
  docker pull -q "$img" >/dev/null || die "Could not pull ${img}. Check the version and the VM's network egress."
  docker pull -q "$DB_IMAGE" >/dev/null
  docker network create "$NETWORK" >/dev/null
  # tmpfs: a fresh, fast database every time; `down` and `up` give a clean server.
  docker run -d --name "$DB" --network "$NETWORK" --tmpfs /var/lib/postgresql/data \
    -e POSTGRES_USER=mmuser -e POSTGRES_PASSWORD=mostest -e POSTGRES_DB=mattermost_test \
    "$DB_IMAGE" >/dev/null
  wait_for "PostgreSQL" 60 db_ready || { docker logs --tail 50 "$DB" >&2; exit 1; }

  local env_args=()
  local kv
  for kv in "${SERVER_ENV[@]}"; do env_args+=(-e "$kv"); done
  # By name only, so the value never appears in the process list or in this log.
  if [ -n "${MM_LICENSE:-}" ]; then
    env_args+=(-e MM_LICENSE)
  else
    log "MM_LICENSE is not set: license-gated specs will skip on this server (they run on CI)."
  fi
  docker run -d --name "$APP" --network "$NETWORK" -p "127.0.0.1:${MM_PORT}:8065" \
    -e MM_SQLSETTINGS_DRIVERNAME=postgres \
    -e "MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:mostest@${DB}:5432/mattermost_test?sslmode=disable&connect_timeout=10" \
    "${env_args[@]}" "$img" >/dev/null
  if ! wait_for "Mattermost at ${URL}" 240 server_ready; then
    docker logs --tail 80 "$APP" >&2 || true
    exit 1
  fi
  log "Server is up: $(api GET /system/ping | jq -r '"version \(.version // "?")"' 2>/dev/null || echo ready) at ${URL}."
}

login() {
  # The session token comes back in the Token header.
  curl -sS --max-time 30 -D - -o /dev/null -H 'Content-Type: application/json' \
    --data-binary "$(jq -nc --arg u "$1" --arg p "$2" '{login_id:$u, password:$p}')" \
    "${URL}/api/v4/users/login" | awk 'tolower($1)=="token:" {print $2}' | tr -d '\r'
}

ensure_user() {
  local username=$1 password=$2 email=$3 token=${4:-}
  if [ -n "$token" ] && api GET "/users/username/${username}" '' "$token" >/dev/null 2>&1; then
    return 0
  fi
  api POST /users "$(jq -nc --arg u "$username" --arg p "$password" --arg e "$email" '{username:$u, password:$p, email:$e}')" "$token" >/dev/null \
    || die "Could not create user ${username}."
}

seed() {
  local token team_id user_id u
  # The first account on a new server becomes its system admin; creating it needs no token.
  token=$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
  if [ -z "$token" ]; then
    ensure_user "$ADMIN_USERNAME" "$ADMIN_PASSWORD" "$ADMIN_EMAIL"
    token=$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
  fi
  [ -n "$token" ] || die "Could not log in as ${ADMIN_USERNAME}."
  api GET /users/me '' "$token" | jq -e '.roles | test("system_admin")' >/dev/null \
    || die "${ADMIN_USERNAME} is not a system admin: the server already had users. Run down, then up."

  ensure_user "$USER_USERNAME" "$USER_PASSWORD" "$USER_EMAIL" "$token"

  team_id=$(api GET "/teams/name/${TEAM_NAME}" '' "$token" 2>/dev/null | jq -r '.id // empty') || team_id=""
  if [ -z "$team_id" ]; then
    team_id=$(api POST /teams "$(jq -nc --arg n "$TEAM_NAME" '{name:$n, display_name:$n, type:"O"}')" "$token" | jq -r .id) \
      || die "Could not create team ${TEAM_NAME}."
  fi
  for u in "$ADMIN_USERNAME" "$USER_USERNAME"; do
    user_id=$(api GET "/users/username/${u}" '' "$token" | jq -r .id)
    api POST "/teams/${team_id}/members" "$(jq -nc --arg t "$team_id" --arg u "$user_id" '{team_id:$t, user_id:$u}')" "$token" >/dev/null \
      || die "Could not add ${u} to team ${TEAM_NAME}."
  done

  umask 077
  cat >"$ENV_FILE" <<EOF
# Written by .cursor/scripts/cloud-agent-mm-server.sh for the local, throwaway E2E server.
export MM_TEST_SERVER_URL='${URL}'
export MM_TEST_USER_NAME='${ADMIN_USERNAME}'
export MM_TEST_PASSWORD='${ADMIN_PASSWORD}'
export MM_TEST_REGULAR_USER_NAME='${USER_USERNAME}'
export MM_TEST_REGULAR_USER_PASSWORD='${USER_PASSWORD}'
export MM_TEST_TEAM_NAME='${TEAM_NAME}'
export MM_TEST_SERVER_IMAGE='$(docker inspect -f '{{.Config.Image}}' "$APP")'
EOF
  log "Seeded ${ADMIN_USERNAME} (system admin), ${USER_USERNAME} and team ${TEAM_NAME}. Env: ${ENV_FILE}"
}

status() {
  server_ready || die "No server answers at ${URL}."
  [ -n "$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")" ] || die "Server is up but ${ADMIN_USERNAME} cannot log in; run up."
  log "Server at ${URL} is up and ${ADMIN_USERNAME} can log in ($(docker inspect -f '{{.Config.Image}}' "$APP" 2>/dev/null))."
}

case "${1:-up}" in
  up) require_docker; start "$(image)"; seed; printf '%s\n' "$ENV_FILE" ;;
  status) status ;;
  down) require_docker; down ;;
  *) die "Usage: $0 up|status|down" ;;
esac
