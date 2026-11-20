output "kubeconfig_path" {
  description = "Use with: export KUBECONFIG=$(terraform output -raw kubeconfig_path)"
  value       = kind_cluster.this.kubeconfig_path
}

output "open_ui" {
  description = "How to reach the app"
  value       = "kubectl port-forward svc/taskmanager-web-gateway 8080:80, then open http://localhost:8080"
}
