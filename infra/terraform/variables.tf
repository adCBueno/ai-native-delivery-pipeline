variable "cluster_name" {
  description = "Name of the local kind cluster"
  type        = string
  default     = "taskmanager"
}

variable "image_registry" {
  description = "Registry prefix for the service images (<registry>/<service>:<tag>)"
  type        = string
  default     = "local"
}

variable "image_tag" {
  description = "Image tag to deploy"
  type        = string
  default     = "dev"
}

variable "image_pull_policy" {
  description = "Never = use images loaded with `kind load`; IfNotPresent = pull from the registry"
  type        = string
  default     = "Never"

  validation {
    condition     = contains(["Never", "IfNotPresent", "Always"], var.image_pull_policy)
    error_message = "image_pull_policy must be Never, IfNotPresent or Always."
  }
}
