locals {
  # EKS access entries need the underlying IAM user/role ARN, not an
  # STS assumed-role session ARN (arn:aws:sts::ACCOUNT:assumed-role/ROLE/SESSION)
  # — which is what aws_caller_identity returns when you're authenticated
  # via an assumed role (e.g. SSO). IAM user ARNs are already in the
  # right form and need no lookup.
  caller_arn              = data.aws_caller_identity.current.arn
  caller_is_assumed_role   = can(regex("^arn:aws:sts::[0-9]+:assumed-role/", local.caller_arn))
  caller_assumed_role_name = local.caller_is_assumed_role ? regex("assumed-role/([^/]+)/", local.caller_arn)[0] : null
}

# Looked up by name (via the real IAM API) rather than string-building
# the ARN — SSO and other assumed roles often live under a path
# (e.g. role/aws-reserved/sso.amazonaws.com/...) that isn't visible in
# the STS assumed-role ARN, so guessing the ARN shape would be wrong.
data "aws_iam_role" "caller" {
  count = local.caller_is_assumed_role ? 1 : 0
  name  = local.caller_assumed_role_name
}

locals {
  caller_principal_arn = local.caller_is_assumed_role ? data.aws_iam_role.caller[0].arn : local.caller_arn
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "${var.project}-eks"
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true # simplest for a small/solo-managed cluster

  enable_irsa = true

  # Modern EKS access control (not the legacy aws-auth configmap) —
  # grants the GitHub Actions deploy role cluster-admin so
  # deploy-eks.yml can kubectl apply/rollout everything.
  authentication_mode = "API_AND_CONFIG_MAP"

  access_entries = {
    github_actions_deploy = {
      principal_arn = aws_iam_role.github_actions_deploy.arn
      policy_associations = {
        admin = {
          policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = { type = "cluster" }
        }
      }
    }

    # Whoever runs `terraform apply`/`terraform destroy` locally needs
    # this too — under the access-entry system, the IAM identity that
    # creates the cluster is NOT automatically granted access (that's
    # only true of the legacy aws-auth path). Without this, the
    # kubernetes/helm providers get "Unauthorized" the moment they try
    # to create anything (see addons.tf), since they authenticate as
    # this same local identity via `aws eks get-token`.
    terraform_operator = {
      principal_arn = local.caller_principal_arn
      policy_associations = {
        admin = {
          policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = { type = "cluster" }
        }
      }
    }
  }

  eks_managed_node_groups = {
    default = {
      # AWS has been retiring AL2-based EKS-optimized AMIs in favor of
      # AL2023 — without this, the module's default ami_type can request
      # an AL2 AMI that AWS no longer publishes for newer/recent
      # Kubernetes minor versions, which fails node group creation with
      # "Requested AMI for this version <x> is not supported". Pinning
      # AL2023 explicitly avoids depending on the module's default.
      ami_type = "AL2023_x86_64_STANDARD"

      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      subnet_ids = module.vpc.private_subnets
    }
  }

  tags = {
    Project = var.project
  }
}
