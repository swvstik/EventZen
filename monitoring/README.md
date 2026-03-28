# EventZen Monitoring

EventZen uses Prometheus + Grafana for application and infrastructure monitoring.

## What Is Monitored

- Application metrics:
  - Node service: http://node-service:8081/metrics
  - Spring service: http://spring-service:8082/actuator/prometheus
  - .NET service: http://dotnet-service:8083/metrics
- Infrastructure metrics:
  - Nginx (via nginx exporter)
  - Docker containers (cAdvisor)
  - MongoDB (mongodb exporter)
  - MySQL (mysqld exporter)
  - Kafka/Redpanda (kafka exporter)
  - MinIO native Prometheus endpoint

## Local Access (localhost only)

- Prometheus UI: http://127.0.0.1:9090
- Grafana UI: http://127.0.0.1:3000

Default Grafana credentials are configured in docker-compose via:
- GRAFANA_ADMIN_USER
- GRAFANA_ADMIN_PASSWORD

## Start

From repository root:

```powershell
docker compose up --build
```

## Verify

1. Open Prometheus and check Targets page:
   - http://127.0.0.1:9090/targets
2. Open Grafana and confirm dashboards are preloaded under folder EventZen.
3. Generate some API traffic and verify charts update.

## Notes

- Monitoring ports are bound to localhost only for safer local development.
- Metrics endpoints are not routed through the public gateway API routes.
- For production, add TLS, auth hardening, and network policies before external exposure.
