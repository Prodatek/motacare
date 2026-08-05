# ============================================================
# MOTACARE — Terraform state backend bootstrap
#
# One-time setup, applied by hand, BEFORE the main stack in
# infra/terraform/. This creates the S3 bucket + DynamoDB lock
# table that hold the main stack's state.
#
# This stack's OWN state stays local (there's nothing to bootstrap
# it with, chicken-and-egg) — its plan is small and stable, so
# that's an acceptable, standard trade-off. Never run
# `terraform destroy` here unless you genuinely want to lose the
# ability to manage the main stack's state.
#
# Usage:
#   cd infra/terraform/bootstrap
#   terraform init
#   terraform apply
#   # copy the printed bucket/table names into ../backend.hcl
# ============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  description = "AWS region for the state backend"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name, used to namespace resources"
  type        = string
  default     = "motacare"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project}-terraform-state"

  # Safety net — accidental `terraform destroy` on this stack
  # won't take the bucket (and your state) with it.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_lock" {
  name         = "${var.project}-terraform-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }
}

output "bucket_name" {
  value = aws_s3_bucket.terraform_state.bucket
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.terraform_lock.name
}

output "region" {
  value = var.region
}
