#!/usr/bin/env bash
# ============================================================
# Motacare — Manual/local Kubernetes Deploy Script
# ============================================================
# For ad-hoc or debugging deploys against the EKS cluster with
# kubectl already configured (`aws eks update-kubeconfig ...`).
# The real, automated path is .github/workflows/deploy-eks.yml —
# this script mirrors the same steps for manual use.
#
# Usage:
#   export REGISTRY=<account>.dkr.ecr.<region>.amazonaws.com
#   export IMAGE_TAG=<git-sha-or-tag>   # defaults to "latest"
#   ./deploy.sh
#
# What it does:
#   1. Applies namespace/config/secrets
#   2. Starts Postgres/Redis (no-op if already running)
#   3. Runs migrations — deploy aborts here if they fail
#   4. Rolls out every service at $IMAGE_TAG
#   5. Applies autoscalers + ingress
#   6. Reports final status
# ============================================================

set -euo pipefail

NAMESPACE="motacare"
K8S_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ECR_PREFIX="motacare"
IMAGE_TAG="${IMAGE_TAG:-latest}"
SERVICES=(auth-service vehicle-service inspection-service fix-jobs alert-service subscription-service workshop-service admin-service crm-service invoicing-service api-gateway web)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Check prerequisites ──────────────────────────────────────
command -v kubectl >/dev/null 2>&1 || error "kubectl not found"
kubectl cluster-info >/dev/null 2>&1 || error "Cannot reach cluster — run 'aws eks update-kubeconfig --name motacare-eks' first"
[ -n "${REGISTRY:-}" ] || error "REGISTRY is not set — export REGISTRY=<account>.dkr.ecr.<region>.amazonaws.com (see: terraform output in infra/terraform/)"

info "Deploying Motacare to namespace: $NAMESPACE (registry: $REGISTRY, tag: $IMAGE_TAG)"
echo ""

# ── Step 1: Namespace, config, secrets ──────────────────────
info "Step 1/6 — Applying namespace, config, secrets..."
kubectl apply -f "$K8S_DIR/namespaces/namespace.yaml"
kubectl apply -f "$K8S_DIR/configmaps/configmap.yaml"

if [ -f "$K8S_DIR/secrets/secrets.yaml" ]; then
  kubectl apply -f "$K8S_DIR/secrets/secrets.yaml"
fi

JWT=$(kubectl get secret motacare-secrets -n "$NAMESPACE" -o jsonpath='{.data.JWT_SECRET}' 2>/dev/null | base64 -d || true)
if [ "${#JWT}" -lt 32 ]; then
  error "JWT_SECRET is empty or too short in motacare-secrets. Fill infra/k8s/secrets/secrets.yaml (or create the secret manually) first."
fi
success "Config and secrets applied"

# ── Step 2: Databases ────────────────────────────────────────
info "Step 2/6 — Starting Postgres/Redis (no-op if already running)..."
kubectl apply -f "$K8S_DIR/statefulsets/postgres.yaml"
kubectl apply -f "$K8S_DIR/statefulsets/redis.yaml"
kubectl rollout status statefulset/postgres -n "$NAMESPACE" --timeout=120s
kubectl rollout status statefulset/redis -n "$NAMESPACE" --timeout=60s
success "Postgres + Redis ready"

# ── Step 3: Run migrations — automated, every deploy ─────────
info "Step 3/6 — Running database migrations..."

sed -E "s#ghcr\.io/Prodatek/motacare/([a-z-]+):latest#${REGISTRY}/${ECR_PREFIX}-\1:${IMAGE_TAG}#g" \
  "$K8S_DIR/jobs/db-migrations.yaml" > /tmp/motacare-db-migrations.yaml

kubectl delete job motacare-migrations -n "$NAMESPACE" --ignore-not-found
kubectl apply -f /tmp/motacare-db-migrations.yaml

info "Waiting for migrations to complete (up to 3 min)..."
if kubectl wait --for=condition=complete job/motacare-migrations \
    -n "$NAMESPACE" --timeout=180s 2>/dev/null; then
  success "Migrations complete"
else
  warn "Migration job may have failed — checking logs..."
  kubectl logs -l job-name=motacare-migrations -n "$NAMESPACE" --tail=50
  error "Migrations failed. Nothing further will be rolled out — fix the errors above and re-run."
fi

# ── Step 4: Deploy services ──────────────────────────────────
info "Step 4/6 — Deploying application services at tag $IMAGE_TAG..."
kubectl apply -f "$K8S_DIR/deployments/"

for svc in "${SERVICES[@]}"; do
  kubectl set image "deployment/$svc" "$svc=${REGISTRY}/${ECR_PREFIX}-${svc}:${IMAGE_TAG}" -n "$NAMESPACE"
done
success "Deployments applied"

# ── Step 5: Autoscalers + Ingress ────────────────────────────
info "Step 5/6 — Applying autoscalers and ingress..."
kubectl apply -f "$K8S_DIR/hpa/hpa.yaml"
kubectl apply -f "$K8S_DIR/ingress/ingress.yaml"
success "Autoscalers + ingress applied"

# ── Step 6: Wait for rollout ─────────────────────────────────
info "Step 6/6 — Waiting for all deployments to roll out..."
FAILED=0
for svc in "${SERVICES[@]}"; do
  if kubectl rollout status "deployment/$svc" -n "$NAMESPACE" --timeout=180s; then
    success "$svc is ready"
  else
    warn "$svc rollout timed out"
    FAILED=$((FAILED + 1))
  fi
done

# ── Final status ─────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo " Motacare Deployment Status"
echo "════════════════════════════════════════════════"
kubectl get pods -n "$NAMESPACE"
echo ""
echo "External endpoint:"
kubectl get ingress -n "$NAMESPACE"

if [ "$FAILED" -eq 0 ]; then
  echo ""
  success "All services deployed successfully!"
  echo ""
  echo "  https://motacare.buildspecs.io"
  echo "  (if DNS/TLS aren't live yet, see infra/terraform/README.md)"
else
  warn "$FAILED deployment(s) may need attention — check logs with:"
  echo "  kubectl logs -l app=<service-name> -n $NAMESPACE --tail=50"
fi
