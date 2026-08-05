# Motacare — AWS EKS via Terraform

One deployment target: AWS EKS. `docker-compose.yml` at the repo root is
for **local development only** — it is not, and should not be treated as,
a deployment path. The real deploy pipeline is `.github/workflows/deploy-eks.yml`,
which builds images, pushes them to ECR, and rolls them out to this cluster.

## One-time setup

```bash
# 1. AWS credentials for an account with EKS/EC2/VPC/IAM/ECR permissions
aws configure    # or aws sso login, whichever this account uses

# 2. State backend (S3 + DynamoDB) — applied once, never destroyed
cd infra/terraform/bootstrap
terraform init
terraform apply
# note the bucket_name / dynamodb_table_name outputs

# 3. Point the main stack at that backend
cd ../
cp backend.hcl.example backend.hcl        # fill in the values from step 2
cp terraform.tfvars.example terraform.tfvars  # fill in github_repository, etc.
terraform init -backend-config=backend.hcl
```

## Bring the cluster up

```bash
terraform apply
```

Takes ~15-20 minutes, mostly EKS control plane provisioning. If this is a
genuinely brand-new AWS account, the kubernetes/helm providers may fail on
the very first apply (they need a cluster that doesn't exist yet at plan
time) — just run `terraform apply` a second time; it's idempotent.

```bash
# Point kubectl at the new cluster
$(terraform output -raw update_kubeconfig_command)

# Set this as the AWS_DEPLOY_ROLE_ARN secret in the GitHub repo
terraform output github_actions_role_arn
```

Push to trigger `deploy-eks.yml` (or run its steps manually the first
time) — it builds every service's image, pushes to ECR, runs the
database migration Job, and rolls out all Deployments.

## Point DNS

```bash
terraform output load_balancer_hostname
# or: kubectl get ingress motacare-ingress -n motacare
```

Create a CNAME: `motacare.buildspecs.io` → that hostname. DNS for this
domain isn't in this AWS account, so Terraform can't do this step for you.

**This hostname changes every time the cluster is destroyed and recreated**
— update the CNAME again after each `terraform apply` that follows a
`terraform destroy`.

Once DNS resolves, cert-manager issues a TLS cert automatically
(`kubectl describe certificate -n motacare` to watch progress).

## Pause spending

```bash
terraform destroy
```

Tears down the VPC, EKS cluster, node group, load balancer, and
everything on it — Postgres/Redis run as in-cluster StatefulSets, not
RDS/ElastiCache, so nothing keeps billing after this. Only the tiny
state-backend bucket/table from the bootstrap stack survives (pennies/month).

To resume: `terraform apply` again, then redo the CNAME step above.
