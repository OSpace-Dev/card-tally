#!/usr/bin/env bash
# Root cron example: /opt/card-ledger/deploy/backup.sh
# Briefly stops the API to copy a consistent SQLite data directory, including key.
set -Eeuo pipefail
umask 077
ledger_project_dir="${LEDGER_PROJECT_DIR:-/opt/card-ledger}"
ledger_backup_dir="${LEDGER_BACKUP_DIR:-/var/backups/card-ledger}"
install -d -m 0700 "$ledger_backup_dir"
exec 9>"$ledger_backup_dir/.backup.lock"
flock -n 9 || { echo 'Another backup is running' >&2; exit 1; }
cd "$ledger_project_dir"
ledger_temp_dir="$(mktemp -d "$ledger_backup_dir/.snapshot.XXXXXX")"
ledger_restart=false
cleanup() {
    if [[ "$ledger_restart" == true ]]; then docker compose start api; fi
    rm -rf -- "$ledger_temp_dir"
}
trap cleanup EXIT
# Require an already running service; do not unexpectedly start a stopped deployment.
ledger_container="$(docker compose ps -q --status running api)"
test -n "$ledger_container"
ledger_restart=true
docker compose stop api
docker compose cp api:/data/. "$ledger_temp_dir/"
docker compose start api
ledger_restart=false
ledger_integrity="$(sqlite3 "$ledger_temp_dir/ledger.sqlite" 'PRAGMA integrity_check;')"
if [[ "$ledger_integrity" != 'ok' ]]; then
    echo 'Backup integrity check failed' >&2
    exit 1
fi
ledger_archive="$ledger_backup_dir/ledger-$(date -u +%Y%m%dT%H%M%S)-$$.tar.gz"
tar -czf "$ledger_archive.partial" -C "$ledger_temp_dir" .
mv -- "$ledger_archive.partial" "$ledger_archive"
find "$ledger_backup_dir" -maxdepth 1 -type f -name 'ledger-*.tar.gz' -mtime +30 -delete
printf 'Backup created: %s\n' "$ledger_archive"
