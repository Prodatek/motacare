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

## 3. Deploy the app

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

## 4. Point DNS

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

## 5. Tear it down to save cost

```bash
cd infra/terraform
terraform destroy
```

Removes the VPC, EKS cluster, node group, load balancer — everything. Postgres and
Redis run as in-cluster StatefulSets (not RDS/ElastiCache), so nothing keeps
billing after this. Only the tiny bootstrap state bucket survives (pennies/month).

To bring it back: repeat from step 2, then redo the CNAME in step 4.

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
