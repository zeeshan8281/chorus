#!/bin/bash
set -e

# 1. Source EigenCompute sealed secrets (KMS-provided env) if present.
if [ -f "/usr/local/bin/compute-source-env.sh" ]; then
  # shellcheck disable=SC1091
  source /usr/local/bin/compute-source-env.sh
fi

export PGDATA="${PGDATA:-/data/pgdata}"
mkdir -p "$PGDATA" "$DATA_DIR"
chown -R postgres:postgres /data

# 2. Initialize PostgreSQL on first boot (on the TEE's encrypted volume).
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  su postgres -c "initdb -D $PGDATA --auth-local=trust --auth-host=trust"
  echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1' -w start"
  su postgres -c "psql --command \"CREATE ROLE memory LOGIN SUPERUSER;\""
  su postgres -c "createdb -O memory memory"
else
  su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1' -w start"
fi

# 3. Start the memory service (schema is applied idempotently on boot).
exec node /app/dist/server.js
