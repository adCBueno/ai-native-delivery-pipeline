#!/usr/bin/env bash
# End-to-end smoke test: goes through the gateway to task-service and MongoDB.
set -euo pipefail

kubectl port-forward svc/taskmanager-web-gateway 8080:80 >/tmp/port-forward.log 2>&1 &
PF_PID=$!
trap 'kill $PF_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -fsS http://localhost:8080/health >/dev/null 2>&1 && break
  sleep 1
done

echo "health:"; curl -fsS http://localhost:8080/health; echo

created=$(curl -fsS -X POST http://localhost:8080/api/tasks \
  -H 'content-type: application/json' -d '{"title":"smoke test"}')
echo "created: $created"
id=$(echo "$created" | sed -E 's/.*"id":"([^"]+)".*/\1/')

curl -fsS http://localhost:8080/api/tasks | grep -q "smoke test"
curl -fsS -X DELETE "http://localhost:8080/api/tasks/$id" -o /dev/null

echo "smoke test passed"
