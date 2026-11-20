# Local environment as code: a kind Kubernetes cluster with TaskManager
# installed from the Helm chart in this repo.
#
#   make images            # build images and load them into the cluster
#   terraform init && terraform apply

terraform {
  required_version = ">= 1.6"

  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.7"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
  }
}

resource "kind_cluster" "this" {
  name           = var.cluster_name
  wait_for_ready = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"
    }
  }
}

provider "helm" {
  kubernetes {
    host                   = kind_cluster.this.endpoint
    client_certificate     = kind_cluster.this.client_certificate
    client_key             = kind_cluster.this.client_key
    cluster_ca_certificate = kind_cluster.this.cluster_ca_certificate
  }
}

resource "helm_release" "taskmanager" {
  name    = "taskmanager"
  chart   = "${path.module}/../../deploy/helm/taskmanager"
  wait    = true
  timeout = 300

  set {
    name  = "image.registry"
    value = var.image_registry
  }

  set {
    name  = "image.tag"
    value = var.image_tag
  }

  set {
    name  = "image.pullPolicy"
    value = var.image_pull_policy
  }
}
