SERVICES := task-service web-gateway
CLUSTER  := taskmanager
TAG      := dev

.PHONY: install lint test check images up smoke down

install: ## install dependencies for both services and the tools
	@for s in $(SERVICES); do (cd services/$$s && npm ci); done
	pip install -r tools/requirements.txt pytest

lint: ## same checks as the CI lint stage
	@for s in $(SERVICES); do (cd services/$$s && npm run lint && npm run typecheck) || exit 1; done

test: ## same checks as the CI test stage
	@for s in $(SERVICES); do (cd services/$$s && npm test) || exit 1; done
	pytest tools

check: lint test

images: ## build images and load them into the local kind cluster
	@for s in $(SERVICES); do \
		docker build -t local/$$s:$(TAG) services/$$s && \
		kind load docker-image --name $(CLUSTER) local/$$s:$(TAG) || exit 1; \
	done

up: ## create the kind cluster and deploy with Terraform
	cd infra/terraform && terraform init && terraform apply -target=kind_cluster.this -auto-approve
	$(MAKE) images
	cd infra/terraform && terraform apply -auto-approve

smoke: ## end-to-end test against the local cluster
	KUBECONFIG=$$(cd infra/terraform && terraform output -raw kubeconfig_path) bash deploy/smoke-test.sh

down: ## delete the local cluster
	cd infra/terraform && terraform destroy -auto-approve
