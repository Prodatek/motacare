variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name, used to namespace/tag every resource"
  type        = string
  default     = "motacare"
}

variable "domain" {
  description = "Public domain the app is served on (DNS managed outside this account — see infra/k8s/ingress/ingress.yaml)"
  type        = string
  default     = "motacare.buildspecs.io"
}

variable "kubernetes_version" {
  description = "EKS control plane version"
  type        = string
  default     = "1.30"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "availability_zone_count" {
  description = "Number of AZs to spread subnets across"
  type        = number
  default     = 2
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_size" {
  description = "Desired node count — kept small; this is a demo/low-traffic deployment, not built for scale"
  type        = number
  default     = 2
}

variable "node_min_size" {
  type    = number
  default = 1
}

variable "node_max_size" {
  type    = number
  default = 3
}

variable "services" {
  description = "Every service that gets its own ECR repository"
  type        = list(string)
  default = [
    "auth-service",
    "vehicle-service",
    "inspection-service",
    "fix-jobs",
    "alert-service",
    "subscription-service",
    "workshop-service",
    "admin-service",
    "crm-service",
    "invoicing-service",
    "api-gateway",
    "web",
  ]
}

variable "github_repository" {
  description = "GitHub \"org/repo\" allowed to assume the CI/CD deploy role via OIDC"
  type        = string
  # e.g. "Prodatek/motacare" — set this in terraform.tfvars
}

variable "letsencrypt_email" {
  description = "Contact email for Let's Encrypt certificate expiry notices"
  type        = string
  default     = "devops@motacare.buildspecs.io"
}
