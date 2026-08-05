# Motacare — Kubernetes Deployment Runbook

**One deployment target: AWS EKS.** `docker-compose.yml` at the repo root
is for local development only — it is never used to deploy. The real,
automated pipeline is `.github/workflows/deploy-eks.yml`, triggered on
every push to `dev`. This document covers the AWS/Terraform side; see
that workflow file for exactly what happens on every deploy.

Full step-by-step instructions (account setup, Terraform state backend,
bringing the cluster up, pointing DNS, tearing it down to save cost) live
in **`infra/terraform/README.md`** — start there. This file covers what
happens *inside* the cluster once it exists.

---

## What's in this directory

```
infra/k8s/
├── namespaces/namespace.yaml       Namespace + ResourceQuota
├── configmaps/configmap.yaml       Non-secret config — service URLs, DB names, ports, domain
├── secrets/secrets.yaml            Template for manual/local secret creation (see below)
├── statefulsets/                   Postgres + Redis, self-hosted in-cluster (not RDS/ElastiCache —
│                                   this is what makes `terraform destroy` leave zero lingering bill)
├── deployments/                    One Deployment + Service per app (all 12 services + web)
├── jobs/db-migrations.yaml         Runs automatically before every rollout — see deploy-eks.yml
├── hpa/hpa.yaml                    Autoscalers for the highest-traffic services
├── ingress/ingress.yaml            Single host (motacare.buildspecs.io) — see the file's own header
│                                   comment for why only `web` and the Stripe webhook path are public
└── scripts/deploy.sh               Manual/local deploy, mirrors deploy-eks.yml's steps
```

## Secrets

`secrets/secrets.yaml` is a **template** — fill in real values and either
`kubectl apply` it directly for a manual/local deploy, or (preferred)
generate it without ever writing secrets to disk:

```bash
kubectl create secret generic motacare-secrets -n motacare \
  --from-literal=JWT_SECRET="$(openssl rand -base64 32)" \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 24)" \
  ... # see secrets.yaml for the full list of keys
```

`deploy-eks.yml` does this automatically from GitHub Actions repo secrets
— nothing sensitive is ever committed.

## Checking status

```bash
kubectl get pods -n motacare
kubectl logs -l app=<service-name> -n motacare --tail=50 -f
kubectl get ingress -n motacare
kubectl get certificate -n motacare   # should show READY=True once DNS is pointed
kubectl top pods -n motacare
```

## Common issues

**TLS cert not issuing** — almost always DNS hasn't been pointed at the
load balancer yet, or hasn't propagated. `kubectl describe certificate
motacare-tls -n motacare` and `kubectl describe certificaterequest -n motacare`
for details.

**Pod crash-looping** — `kubectl describe pod <name> -n motacare` and
`kubectl logs <name> -n motacare --previous`.

**Migration job failed** — the deploy pipeline aborts before rolling out
anything if this happens (see `deploy-eks.yml`'s "Run database migrations"
step). Check `kubectl logs -l job-name=motacare-migrations -n motacare`,
fix the issue, and re-run the workflow (or `./scripts/deploy.sh` locally).

**Scale a service manually**

```bash
kubectl scale deployment fix-jobs --replicas=2 -n motacare
```
