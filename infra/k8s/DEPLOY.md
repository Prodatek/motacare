# Motacare — Kubernetes Deployment Runbook

## Prerequisites

### Tools
```bash
# kubectl — Kubernetes CLI
# macOS:
brew install kubectl

# Linux:
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Verify
kubectl version --client
```

### Cluster requirements
Any managed Kubernetes cluster works. Recommended:
- **AWS**: EKS (use eksctl to provision)
- **GCP**: GKE Autopilot (easiest — autoscaling built in)
- **DigitalOcean**: DOKS (cheapest for early-stage)
- **Self-hosted**: k3s on a VPS (good for pitching, costs ~$20/mo)

Minimum cluster spec: **2 nodes × 2 vCPU / 4GB RAM**

---

## First-time Setup

### 1. Install the Nginx Ingress Controller
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# Wait for it to get an external IP
kubectl get svc ingress-nginx-controller -n ingress-nginx -w
# Copy the EXTERNAL-IP value
```

### 2. Install cert-manager (free Let's Encrypt TLS)
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

# Wait for it to be ready
kubectl rollout status deployment/cert-manager -n cert-manager --timeout=60s
```

### 3. Point your DNS at the cluster
In your domain registrar (or DNS provider), add two A records:

| Hostname          | Type | Value              |
|---|---|---|
| app.motacare.ng   | A    | \<EXTERNAL-IP\>    |
| api.motacare.ng   | A    | \<EXTERNAL-IP\>    |

Wait for DNS propagation (usually 5–15 minutes). Verify:
```bash
dig app.motacare.ng +short   # should return your EXTERNAL-IP
dig api.motacare.ng +short
```

### 4. Fill in your secrets
Edit `secrets/02-secrets.yaml` and replace every `REPLACE_*` value:

```bash
# Generate strong secrets
openssl rand -base64 32   # use for JWT_SECRET and VEHICLE_HASH_SECRET
openssl rand -base64 24   # use for POSTGRES_PASSWORD
```

**Never commit the filled secrets file to git.** Add it to `.gitignore`:
```
infra/k8s/secrets/02-secrets.yaml
```

### 5. Update the GitHub org in manifests
Replace `Prodatek` in:
- All deployment files (image references): `ghcr.io/Prodatek/motacare/...`
- `scripts/deploy-workflow.yml`: `ORG: Prodatek`

```bash
# Bulk replace — run from the k8s directory
find . -type f | xargs sed -i 's/Prodatek/YOUR_ACTUAL_ORG/g'
```

---

## Deploying

### First deploy
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

The script will:
1. Apply namespace, config, secrets
2. Start PostgreSQL and Redis
3. Run all database migrations
4. Deploy all services
5. Apply autoscalers
6. Configure ingress with TLS

### Subsequent deploys (after code changes)
```bash
# Build + push + deploy in CI (automatic on merge to main)
git push origin main

# Or manually with a specific tag:
IMAGE_TAG=abc123 ./scripts/deploy.sh
```

---

## Checking status
```bash
# All pods
kubectl get pods -n motacare

# Logs for a specific service
kubectl logs -l app=api-gateway -n motacare --tail=50 -f

# Ingress and TLS status
kubectl get ingress -n motacare
kubectl get certificate -n motacare   # should show READY=True within 2 min

# Resource usage
kubectl top pods -n motacare
```

---

## Common issues

### TLS cert not issuing
```bash
kubectl describe certificate motacare-api-tls -n motacare
kubectl describe certificaterequest -n motacare
```
Most common cause: DNS hasn't propagated yet. Wait and retry.

### Pod crash-looping
```bash
kubectl describe pod <pod-name> -n motacare
kubectl logs <pod-name> -n motacare --previous
```

### Migration job failed
```bash
kubectl logs -l job-name=motacare-migrations -n motacare
# Fix the error, then:
kubectl delete job motacare-migrations -n motacare
kubectl apply -f jobs/08-db-migrations.yaml
```

### Scale a service manually
```bash
kubectl scale deployment api-gateway --replicas=4 -n motacare
```

---

## Folder structure
```
infra/k8s/
├── namespaces/
│   └── 00-namespace.yaml
├── configmaps/
│   └── 01-configmap.yaml
├── secrets/
│   └── 02-secrets.yaml          ← NEVER commit filled version
├── statefulsets/
│   ├── 03-postgres.yaml
│   └── 04-redis.yaml
├── deployments/
│   ├── 05-auth-service.yaml
│   ├── 06-api-gateway.yaml
│   ├── 07-web.yaml
│   └── svc-*.yaml               ← generated for each microservice
├── jobs/
│   └── 08-db-migrations.yaml
├── hpa/
│   └── 09-hpa.yaml
├── ingress/
│   └── 10-ingress.yaml
└── scripts/
    ├── deploy.sh
    └── deploy-workflow.yml      ← copy to .github/workflows/deploy.yml
```