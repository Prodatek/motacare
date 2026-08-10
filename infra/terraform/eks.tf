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
  # deploy-eks.yml can kubectl apply/rollout everything. Your own
  # IAM user/role needs an access entry too if you'll run kubectl
  # locally — add it here once you know which IAM identity that is.
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
