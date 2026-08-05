# ============================================================
# CLUSTER ADD-ONS — installed here (not kubectl-applied by CI)
# because they're cluster infrastructure, not application code:
# they change rarely and the whole point of an Ingress/TLS story
# is that it needs to exist before any app Deployment can be
# usefully reached.
# ============================================================

resource "kubernetes_namespace" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
  }
  depends_on = [module.eks]
}

resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  namespace  = kubernetes_namespace.ingress_nginx.metadata[0].name
  version    = "4.11.2"

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  # Network Load Balancer instead of the default Classic LB — cheaper
  # and the modern AWS-recommended choice for ingress-nginx.
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type"
    value = "nlb"
  }

  depends_on = [module.eks]
}

resource "kubernetes_namespace" "cert_manager" {
  metadata {
    name = "cert-manager"
  }
  depends_on = [module.eks]
}

resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  namespace  = kubernetes_namespace.cert_manager.metadata[0].name
  version    = "v1.15.1"

  set {
    name  = "installCRDs"
    value = "true"
  }

  depends_on = [module.eks]
}

# Reads back the load balancer hostname ingress-nginx provisioned,
# so `terraform output` gives you the exact value to CNAME
# motacare.buildspecs.io to. Populated a minute or two after apply —
# if it's blank, wait for the LB to finish provisioning and re-run
# `terraform refresh` / `terraform output`.
data "kubernetes_service" "ingress_nginx_controller" {
  metadata {
    name      = "ingress-nginx-controller"
    namespace = kubernetes_namespace.ingress_nginx.metadata[0].name
  }
  depends_on = [helm_release.ingress_nginx]
}

output "load_balancer_hostname" {
  description = "CNAME motacare.buildspecs.io to this hostname"
  value       = try(data.kubernetes_service.ingress_nginx_controller.status[0].load_balancer[0].ingress[0].hostname, "not-yet-provisioned — re-run `terraform output` in a minute")
}
