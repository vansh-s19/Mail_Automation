#!/bin/sh
# One image, two Railway services (api/worker) - which process actually runs
# is picked at runtime by the $WORKSPACE env var set on each service, rather
# than building/deploying two separate images for what is otherwise identical
# code. Migrations run only from the api service to avoid two services racing
# to apply them on the same deploy.
set -e

if [ "$WORKSPACE" = "apps/api" ]; then
  npm run prisma:deploy
fi

exec npm run start --workspace="$WORKSPACE"
