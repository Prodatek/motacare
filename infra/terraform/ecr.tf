resource "aws_ecr_repository" "service" {
  for_each = toset(var.services)

  name                 = "${var.project}-${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keep each repo tidy — only the last 10 images, so ECR storage
# doesn't quietly grow forever across repeated deploys.
resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = aws_ecr_repository.service
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

output "ecr_repository_urls" {
  description = "ECR repository URL per service — used by deploy-eks.yml to build/push/deploy"
  value       = { for k, v in aws_ecr_repository.service : k => v.repository_url }
}
