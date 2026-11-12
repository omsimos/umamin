#!/usr/bin/env bash
# Fails when a migration added since <base-ref> drops or renames something
# without a marker line. migrate.yml and the Worker deploy are not ordered, so
# a destructive migration breaks whichever side still expects the old schema.
# DROP INDEX is allowed: it costs speed, not correctness.
set -euo pipefail

base="${1:?usage: check-additive-migrations.sh <base-ref>}"
marker='-- destructive-ok:'
pattern='DROP[[:space:]]+TABLE|DROP[[:space:]]+COLUMN|RENAME[[:space:]]|__new_'

status=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  if grep -Eiq "$pattern" "$file" && ! grep -Fq -e "$marker" "$file"; then
    echo "::error file=$file::Destructive statement without a '$marker <reason>' line. See packages/db/AGENTS.md, 'How migrations ship'."
    grep -Ein "$pattern" "$file" || true
    status=1
  fi
done < <(
  git diff --name-only --diff-filter=A "$base" HEAD -- \
    'packages/db/migrations/*.sql' 'packages/org-db/migrations/*.sql'
)

exit "$status"
