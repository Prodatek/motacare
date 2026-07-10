#!/usr/bin/env bash
# ============================================================
# MOTACARE — Service Diagnostic
# Run this BEFORE applying changes to understand current state.
# No changes are made.
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     Motacare Service Diagnostic              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Docker containers ────────────────────────────────────────
echo "RUNNING CONTAINERS:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
  || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# ── Health checks ────────────────────────────────────────────
echo "SERVICE HEALTH CHECKS:"
declare -A SERVICES=(
  ["auth-service"]="http://localhost:3001/health"
  ["vehicle-service"]="http://localhost:3002/health"
  ["inspection-service"]="http://localhost:3003/health"
  ["fix-jobs"]="http://localhost:3004/health"
  ["subscription-service"]="http://localhost:3007/health"
  ["workshop-service"]="http://localhost:3008/health"
  ["admin-service"]="http://localhost:3009/health"
  ["crm-service"]="http://localhost:3010/health"
  ["api-gateway"]="http://localhost:3000/health"
)

for svc in "${!SERVICES[@]}"; do
  url="${SERVICES[$svc]}"
  response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url" 2>/dev/null)
  if [ "$response" = "200" ]; then
    echo "  ✅ $svc ($url)"
  elif [ "$response" = "503" ]; then
    echo "  ⚠️  $svc — degraded (503) $url"
  else
    echo "  ❌ $svc — unreachable (HTTP $response) $url"
  fi
done
echo ""

# ── Gateway health detail ────────────────────────────────────
echo "GATEWAY UPSTREAM STATUS:"
curl -s http://localhost:3000/health 2>/dev/null | python3 -m json.tool 2>/dev/null \
  || echo "  (gateway not reachable)"
echo ""

# ── Check gateway env.ts for missing service URLs ────────────
echo "GATEWAY env.ts SERVICE URL CHECK:"
ENV_FILE="apps/api-gateway/src/config/env.ts"
if [ -f "$ENV_FILE" ]; then
  for svc in ADMIN_SERVICE_URL CRM_SERVICE_URL WORKSHOP_SERVICE_URL \
             SUBSCRIPTION_SERVICE_URL FIX_JOBS_SERVICE_URL; do
    if grep -q "$svc" "$ENV_FILE"; then
      echo "  ✅ $svc present"
    else
      echo "  ❌ $svc MISSING — will cause 502 for those routes"
    fi
  done
else
  echo "  ❌ $ENV_FILE not found"
fi
echo ""

# ── Check gateway main.ts for proxy registrations ───────────
echo "GATEWAY main.ts PROXY REGISTRATION CHECK:"
MAIN_FILE="apps/api-gateway/src/main.ts"
if [ -f "$MAIN_FILE" ]; then
  for proxy in registerAdminProxy registerCrmProxy registerWorkshopProxy \
               registerSubscriptionProxy registerFixJobsProxy; do
    if grep -q "$proxy" "$MAIN_FILE"; then
      echo "  ✅ $proxy registered"
    else
      echo "  ❌ $proxy NOT registered — routes will 404"
    fi
  done
else
  echo "  ❌ $MAIN_FILE not found"
fi
echo ""

# ── Check docker-compose for all services ───────────────────
echo "docker-compose.yml SERVICE PRESENCE:"
DC="docker-compose.yml"
if [ -f "$DC" ]; then
  for svc in admin-service crm-service workshop-service subscription-service \
             fix-jobs alert-service; do
    if grep -q "container_name.*$svc\|$svc:" "$DC"; then
      echo "  ✅ $svc defined"
    else
      echo "  ❌ $svc MISSING from docker-compose.yml"
    fi
  done
  if grep -q "ADMIN_SERVICE_URL" "$DC"; then
    echo "  ✅ ADMIN_SERVICE_URL in gateway env block"
  else
    echo "  ❌ ADMIN_SERVICE_URL missing from gateway env block"
  fi
  if grep -q "CRM_SERVICE_URL" "$DC"; then
    echo "  ✅ CRM_SERVICE_URL in gateway env block"
  else
    echo "  ❌ CRM_SERVICE_URL missing from gateway env block"
  fi
else
  echo "  ❌ docker-compose.yml not found in current directory"
fi
echo ""

# ── Database check ───────────────────────────────────────────
echo "DATABASE PRESENCE:"
for db in motacare_auth motacare_vehicles motacare_inspections \
          motacare_fixjobs motacare_subscriptions \
          motacare_workshops motacare_crm; do
  result=$(docker compose exec -T postgres \
    psql -U motacare -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$db';" 2>/dev/null)
  if [ "$result" = "1" ]; then
    echo "  ✅ $db"
  else
    echo "  ❌ $db — does not exist (needs to be created)"
  fi
done
echo ""

echo "════════════════════════════════════════════════"
echo "Fix guide:"
echo "  1. Replace docker-compose.yml with the complete version"
echo "  2. Replace apps/api-gateway/src/config/env.ts"
echo "  3. Replace apps/api-gateway/src/main.ts"
echo "  4. docker compose up -d --build"
echo "════════════════════════════════════════════════"