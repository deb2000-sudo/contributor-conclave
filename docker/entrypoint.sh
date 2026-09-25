#!/bin/sh
set -eu

# Docker sets HOSTNAME to the container id. Next.js binds to that name,
# so Cloud Run would not reach the process. Listen on every interface.
export HOSTNAME=0.0.0.0

# Cloud Run sets PORT. The image default is 8080 when the variable is absent.
exec node server.js
