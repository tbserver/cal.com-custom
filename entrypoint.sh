#!/bin/sh
set -e

export DATABASE_URL="${CALCOM_DATABASE_URL:-postgresql://calcom:${CALCOM_POSTGRES_PASSWORD:-calcompass}@calcom_db:5432/calcom}"
export DATABASE_DIRECT_URL="${CALCOM_DATABASE_DIRECT_URL:-$DATABASE_URL}"
export NEXTAUTH_SECRET="${CALCOM_NEXTAUTH_SECRET}"
export NEXTAUTH_URL="${CALCOM_NEXTAUTH_URL}"
export NEXT_PUBLIC_WEBAPP_URL="${CALCOM_NEXT_PUBLIC_WEBAPP_URL:-$NEXTAUTH_URL}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-$NEXT_PUBLIC_WEBAPP_URL}"
export NEXTAUTH_URL_INTERNAL="${CALCOM_NEXTAUTH_URL_INTERNAL:-http://localhost:3000}"
export NEXT_PUBLIC_API_V2_URL="${CALCOM_NEXT_PUBLIC_API_V2_URL}"
export CALENDSO_ENCRYPTION_KEY="${CALCOM_CALENDSO_ENCRYPTION_KEY}"
export CALCOM_LICENSE_KEY="${CALCOM_CALCOM_LICENSE_KEY}"
export NEXT_PUBLIC_LICENSE_CONSENT="${CALCOM_NEXT_PUBLIC_LICENSE_CONSENT:-agree}"

# ALLOWED_HOSTNAMES is consumed by: JSON.parse(`[${process.env.ALLOWED_HOSTNAMES}]`)
# So the value must be JSON-quoted strings WITHOUT outer brackets, e.g. "host1","host2"
if [ -n "${CALCOM_ALLOWED_HOSTNAMES}" ]; then
	# Strip outer brackets/whitespace, then ensure each host is JSON-quoted
	bare="$(printf '%s' "${CALCOM_ALLOWED_HOSTNAMES}" | sed -E 's/^\s*\[+//; s/\]+\s*$//; s/["[:space:]]//g')"
	# bare is now e.g. rdv.datapinpin.fr or host1,host2
	quoted="$(printf '%s' "$bare" | sed -E 's/([^,]+)/"\1"/g')"
	export ALLOWED_HOSTNAMES="${quoted}"
elif [ -n "${NEXT_PUBLIC_WEBAPP_URL}" ]; then
	host="$(printf '%s' "${NEXT_PUBLIC_WEBAPP_URL}" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##')"
	export ALLOWED_HOSTNAMES="\"${host}\""
fi

export EMAIL_FROM="${CALCOM_EMAIL_FROM}"
export EMAIL_SERVER_HOST="${CALCOM_EMAIL_SERVER_HOST}"
export EMAIL_SERVER_PORT="${CALCOM_EMAIL_SERVER_PORT}"
export EMAIL_SERVER_USER="${CALCOM_EMAIL_SERVER_USER}"
export EMAIL_SERVER_PASSWORD="${CALCOM_EMAIL_SERVER_PASSWORD}"
export SHOPIFY_STOREFRONT_TOKEN="${CALCOM_SHOPIFY_STOREFRONT_TOKEN}"
export SHOPIFY_STOREFRONT_DOMAIN="${CALCOM_SHOPIFY_STOREFRONT_DOMAIN}"
export SHOPIFY_COLLECTION_HANDLE="${CALCOM_SHOPIFY_COLLECTION_HANDLE}"
export NODE_ENV="production"

cd /app

# Replace build-time placeholder URL with runtime URL in all compiled assets
if [ -n "${NEXT_PUBLIC_WEBAPP_URL}" ] && [ "${NEXT_PUBLIC_WEBAPP_URL}" != "http://localhost:3000" ]; then
	echo "Replacing http://localhost:3000 with ${NEXT_PUBLIC_WEBAPP_URL} in compiled assets..."
	find apps/web/.next/ apps/web/public/ -type f \( -name '*.js' -o -name '*.json' -o -name '*.html' -o -name '*.css' -o -name '*.js.map' \) \
		-exec grep -l 'http://localhost:3000' {} \; \
		-exec sed -i "s|http://localhost:3000|${NEXT_PUBLIC_WEBAPP_URL}|g" {} \;
	# Also replace bare localhost:3000 (without protocol) used in edge middleware
	find apps/web/.next/ apps/web/public/ -type f \( -name '*.js' -o -name '*.json' -o -name '*.html' -o -name '*.css' -o -name '*.js.map' \) \
		-exec grep -l 'localhost:3000' {} \; \
		-exec sed -i "s|localhost:3000|$(echo "${NEXT_PUBLIC_WEBAPP_URL}" | sed 's|https\?://||')|g" {} \;
	echo "URL replacement complete."
fi

yarn workspace @calcom/prisma db-deploy
yarn workspace @calcom/prisma seed-app-store || true

exec yarn workspace @calcom/web start
