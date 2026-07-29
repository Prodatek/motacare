#!/usr/bin/env bash
# ============================================================
# Motacare — Kubernetes Deploy Script
# ============================================================
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# What it does:
#   1. Applies all manifests in the right order
#   2. Waits for databases to be ready before starting services
#   3. Runs migrations before deploying application pods
#   4. Performs a rolling deploy of all services
#   5. Reports final status
# ============================================================

set -euo pipefail

NAMESPACE="motacare"
K8S_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY="ghcr.io/Prodatek/motacare"
IMAGE_TAG="${IMAGE_TAG:-latest}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Check prerequisites ──────────────────────────────────────
command -v kubectl >/dev/null 2>&1 || error "kubectl not found"
kubectl cluster-info >/dev/null 2>&1 || error "Cannot reach cluster — check your kubeconfig"

info "Deploying Motacare to namespace: $NAMESPACE (tag: $IMAGE_TAG)"
echo ""

# ── Step 1: Namespace and config ────────────────────────────
info "Step 1/6 — Applying namespace and config..."
kubectl apply -f "$K8S_DIR/namespaces/namespace.yaml"
kubectl apply -f "$K8S_DIR/configmaps/configmap.yaml"
kubectl apply -f "$K8S_DIR/secrets/secrets.yaml"

# Verify secrets are populated
JWT=$(kubectl get secret motacare-secrets -n $NAMESPACE -o jsonpath='{.data.JWT_SECRET}' 2>/dev/null | base64 -d)
if [ ${#JWT} -lt 32 ]; then
  error "JWT_SECRET is empty or too short in motacare-secrets. Fill secrets/secrets.yaml first."
fi
success "Config and secrets applied"

# ── Step 2: Databases ────────────────────────────────────────
info "Step 2/6 — Starting databases..."
kubectl apply -f "$K8S_DIR/statefulsets/postgres.yaml"
kubectl apply -f "$K8S_DIR/statefulsets/redis.yaml"

info "Waiting for PostgreSQL to be ready (up to 2 min)..."
kubectl rollout status statefulset/postgres -n $NAMESPACE --timeout=120s
success "PostgreSQL ready"

info "Waiting for Redis to be ready..."
kubectl rollout status statefulset/redis -n $NAMESPACE --timeout=60s
success "Redis ready"

# ── Step 3: Run migrations ───────────────────────────────────
info "Step 3/6 — Running database migrations..."

# Delete previous migration job if it exists
kubectl delete job motacare-migrations -n $NAMESPACE --ignore-not-found

# Apply and wait for completion
kubectl apply -f "$K8S_DIR/jobs/db-migrations.yaml"

info "Waiting for migrations to complete (up to 3 min)..."
if kubectl wait --for=condition=complete job/motacare-migrations \
    -n $NAMESPACE --timeout=180s 2>/dev/null; then
  success "Migrations complete"
else
  warn "Migration job may have failed — checking logs..."
  kubectl logs -l job-name=motacare-migrations -n $NAMESPACE --tail=50
  error "Migrations failed. Fix the errors above before continuing."
fi

# ── Step 4: Deploy services ──────────────────────────────────
info "Step 4/6 — Deploying application services..."

# Update image tags if IMAGE_TAG is not 'latest'
if [ "$IMAGE_TAG" != "latest" ]; then
  info "Setting image tag to $IMAGE_TAG for all deployments..."
  SERVICES=(auth-service vehicle-service inspection-service fix-jobs alert-service subscription-service invoicing-service api-gateway web)
  for svc in "${SERVICES[@]}"; do
    IMAGE_NAME="${REGISTRY}/${svc}:${IMAGE_TAG}"
    kubectl set image deployment/$svc $svc=$IMAGE_NAME -n $NAMESPACE 2>/dev/null || true
  done
fi

# Apply all deployment manifests
kubectl apply -f "$K8S_DIR/deployments/"

success "Deployments applied"

# ── Step 5: Autoscalers ──────────────────────────────────────
info "Step 5/6 — Applying autoscalers..."
kubectl apply -f "$K8S_DIR/hpa/hpa.yaml"
success "HPAs applied"

# ── Step 6: Ingress ──────────────────────────────────────────
info "Step 6/6 — Applying ingress..."
kubectl apply -f "$K8S_DIR/ingress/ingress.yaml"
success "Ingress applied"

# ── Wait for all deployments to roll out ────────────────────
echo ""
info "Waiting for all deployments to roll out..."
DEPLOYMENTS=(auth-service vehicle-service inspection-service fix-jobs alert-service subscription-service invoicing-service api-gateway web)
FAILED=0

for deployment in "${DEPLOYMENTS[@]}"; do
  if kubectl rollout status deployment/$deployment -n $NAMESPACE --timeout=120s; then
    success "$deployment is ready"
  else
    warn "$deployment rollout timed out"
    FAILED=$((FAILED + 1))
  fi
done

# ── Final status ─────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo " Motacare Deployment Status"
echo "════════════════════════════════════════════════"
kubectl get pods -n $NAMESPACE
echo ""
echo "External endpoints:"
kubectl get ingress -n $NAMESPACE

if [ $FAILED -eq 0 ]; then
  echo ""
  success "All services deployed successfully!"
  echo ""
  echo "  Web:  https://app.motacare.ng"
  echo "  API:  https://api.motacare.ng"
  echo "  Docs: https://api.motacare.ng/docs"
else
  warn "$FAILED deployment(s) may need attention — check logs with:"
  echo "  kubectl logs -l app=<service-name> -n $NAMESPACE --tail=50"
fi