# 🚀 Deploying Motacare

One deployment target: **AWS EKS**, provisioned by Terraform. `docker-compose.yml`
is local development only — it is never used to deploy.

This is the quick-start version. Full details live in:
- [`infra/terraform/README.md`](infra/terraform/README.md) — Terraform/AWS side
- [`infra/k8s/DEPLOY.md`](infra/k8s/DEPLOY.md) — what's running inside the cluster
- [`.github/workflows/deploy-eks.yml`](.github/workflows/deploy-eks.yml) — the actual CI/CD pipeline

---

## Prerequisites

- AWS account + credentials (`aws configure` or SSO) with EKS/EC2/VPC/IAM/ECR permissions
- `terraform` >= 1.5, `kubectl`, `aws` CLI
- Access to add a DNS record for `motacare.buildspecs.io` (managed outside this AWS account)

---

## 1. One-time: Terraform state backend

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

This creates a small S3 bucket + DynamoDB lock table that **never gets destroyed** —
it's separate from everything else so tearing the cluster down never risks your state.

## 2. Bring the cluster up

```bash
cd ..   # infra/terraform/
cp backend.hcl.example backend.hcl               # fill in from step 1's outputs
cp terraform.tfvars.example terraform.tfvars      # fill in github_repository, etc.

terraform init -backend-config=backend.hcl
terraform apply
```

Takes ~15-20 minutes (mostly EKS control plane provisioning). Provisions the VPC,
EKS cluster, one ECR repo per service, the GitHub Actions OIDC deploy role, and
installs ingress-nginx + cert-manager as cluster add-ons.

> First apply on a brand-new AWS account may need to be run twice — the
> Kubernetes/Helm providers can't authenticate against a cluster that doesn't
> exist yet on their first pass. This is a known EKS + Terraform quirk, not a bug.

```bash
$(terraform output -raw update_kubeconfig_command)   # point kubectl at the cluster
terraform output github_actions_role_arn             # set as the AWS_DEPLOY_ROLE_ARN GitHub secret
```

## 3. Set the required GitHub Actions secrets

`deploy-eks.yml` reads everything below from **repo Settings → Secrets and
variables → Actions → New repository secret** (or `gh secret set NAME`). The
pipeline will fail before it does anything useful if these are missing.

1. **`AWS_DEPLOY_ROLE_ARN`** — the OIDC role from step 2: `terraform output github_actions_role_arn`. This is what lets Actions push to ECR and deploy to EKS without any long-lived AWS keys.
2. **`JWT_SECRET`** — auth token signing key, used by every service. Generate: `openssl rand -base64 32`. Must be ≥32 characters.
3. **`VEHICLE_HASH_SECRET`** — HMAC key for vehicle hash generation. Generate: `openssl rand -base64 32`.
4. **`POSTGRES_USER`** — e.g. `motacare`. Must match across every service since they share one Postgres instance.
5. **`POSTGRES_PASSWORD`** — a strong password for that user. Generate: `openssl rand -base64 24`.
6. **`STRIPE_SECRET_KEY`** — Stripe secret key. Leave the secret **present but empty** if billing isn't configured yet — subscription-service boots fine without it, checkout/portal/webhooks just return 503 until it's set.
7. **`STRIPE_WEBHOOK_SECRET`** — Stripe webhook signing secret (from the Stripe dashboard once you've pointed a webhook at `https://motacare.buildspecs.io/webhooks/stripe`). Can also be left empty for now.
8. **`STRIPE_PRICE_PRO_MONTHLY`** — Stripe Price ID for the Pro monthly plan. Empty is fine until Stripe is configured.
9. **`STRIPE_PRICE_PRO_YEARLY`** — Stripe Price ID for the Pro yearly plan.
10. **`STRIPE_PRICE_WORKSHOP_MONTHLY`** — Stripe Price ID for the Workshop monthly plan.
11. **`STRIPE_PRICE_WORKSHOP_YEARLY`** — Stripe Price ID for the Workshop yearly plan.
12. **`SMTP_HOST`** — outbound email host for alert-service (e.g. a Mailtrap/SES/SendGrid SMTP endpoint).
13. **`SMTP_PORT`** — usually `587`.
14. **`SMTP_USER`** — SMTP auth username.
15. **`SMTP_PASS`** — SMTP auth password.
16. **`EMAIL_FROM`** — e.g. `noreply@motacare.buildspecs.io`.
17. **`EMAIL_FROM_NAME`** — e.g. `Motacare`.

Quick way to set them all from a local `.env`-style file (never commit it):

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --body "$(cd infra/terraform && terraform output -raw github_actions_role_arn)"
gh secret set JWT_SECRET --body "$(openssl rand -base64 32)"
gh secret set VEHICLE_HASH_SECRET --body "$(openssl rand -base64 32)"
gh secret set POSTGRES_USER --body "motacare"
gh secret set POSTGRES_PASSWORD --body "$(openssl rand -base64 24)"
# Stripe + SMTP: repeat `gh secret set NAME --body "value"` for items 6–17,
# using "" for any you're leaving blank until they're configured.
```

## 4. Deploy the app

Push to `dev`, or trigger **Deploy to EKS** manually from the GitHub Actions tab.

The pipeline builds every service's production image, pushes to ECR, then — **every
single deploy, fully automated** — applies config/secrets, runs the database
migration Job (the deploy aborts here if migrations fail, nothing rolls forward
broken), and rolls out every service at the new image.

For a manual/local deploy instead:

```bash
export REGISTRY=<account>.dkr.ecr.<region>.amazonaws.com   # from terraform output
export IMAGE_TAG=<git-sha-or-tag>
./infra/k8s/scripts/deploy.sh
```

## 5. Point DNS

```bash
terraform output load_balancer_hostname
# or: kubectl get ingress motacare-ingress -n motacare
```

Create a CNAME: `motacare.buildspecs.io` → that hostname. Terraform can't do this
step for you since DNS for this domain lives outside this AWS account.

⚠️ **That hostname changes every time the cluster is destroyed and recreated** —
update the CNAME again after each `terraform apply` that follows a `terraform destroy`.

TLS is automatic once DNS resolves — cert-manager issues a Let's Encrypt cert
(`kubectl describe certificate -n motacare` to watch progress).

## 6. Tear it down to save cost

```bash
cd infra/terraform
terraform destroy
```

Removes the VPC, EKS cluster, node group, load balancer — everything. Postgres and
Redis run as in-cluster StatefulSets (not RDS/ElastiCache), so nothing keeps
billing after this. Only the tiny bootstrap state bucket survives (pennies/month).

To bring it back: repeat from step 2, then redo the CNAME in step 5. GitHub
secrets persist across this — no need to redo step 3 (the deploy role's ARN
is stable across recreations since it's the same IAM role name).

---

## Quick reference

| Task | Command |
|---|---|
| Check pods | `kubectl get pods -n motacare` |
| Tail logs | `kubectl logs -l app=<service> -n motacare --tail=50 -f` |
| Check ingress / LB hostname | `kubectl get ingress -n motacare` |
| Check TLS cert | `kubectl get certificate -n motacare` |
| Migration logs | `kubectl logs -l job-name=motacare-migrations -n motacare` |
| Scale a service | `kubectl scale deployment <service> --replicas=2 -n motacare` |
| Re-run migrations manually | `kubectl delete job motacare-migrations -n motacare && kubectl apply -f infra/k8s/jobs/db-migrations.yaml` |

Public URL once DNS/TLS are live: **https://motacare.buildspecs.io**
