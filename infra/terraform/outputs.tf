output "cluster_name" {
  value = module.eks.cluster_name
}

output "update_kubeconfig_command" {
  description = "Run this after every apply to point kubectl at the cluster"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
