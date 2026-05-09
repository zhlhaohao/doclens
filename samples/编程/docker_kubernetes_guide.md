# Docker and Kubernetes Guide: Containerization and Orchestration

## The Container Revolution

Containerization has fundamentally changed how software is built, shipped, and run. Docker introduced the concept of lightweight, portable containers to the mainstream, while Kubernetes provides the orchestration layer to manage containers at scale across clusters of machines.

## Docker Fundamentals

### Containers vs Virtual Machines
Containers differ from traditional virtual machines in several key ways:

- **Size**: Container images are typically megabytes vs. gigabytes for VMs
- **Startup time**: Containers start in milliseconds vs. minutes for VMs
- **Isolation**: Containers share the host kernel, VMs have their own OS kernel
- **Resource efficiency**: Containers use only the resources needed by the application
- **Density**: You can run 10-100x more containers than VMs on the same hardware

### Dockerfile Best Practices
A well-crafted Dockerfile is the foundation of efficient containerization:

```dockerfile
# Multi-stage build for smaller images
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
```

Key Dockerfile optimization strategies:

1. **Multi-stage builds**: Separate build and runtime stages to reduce final image size by 60-80%
2. **Layer caching**: Order instructions from least to most frequently changing
3. **Alpine-based images**: Use Alpine Linux variants for 5-10x smaller base images
4. **Non-root user**: Always run as a non-privileged user for security
5. **Specific tags**: Avoid `latest` tags; pin exact versions for reproducibility

### Docker Compose
Docker Compose defines multi-container applications in a single YAML file:

```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/app
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## Kubernetes Architecture

### Core Components
A Kubernetes cluster consists of:

**Control Plane (Master Nodes)**
- **API Server**: The front-end of the control plane, all communication goes through it
- **etcd**: Distributed key-value store for cluster state
- **Scheduler**: Assigns pods to nodes based on resource requirements
- **Controller Manager**: Maintains desired state (replicas, deployments, etc.)

**Worker Nodes**
- **kubelet**: Agent that ensures containers are running in pods
- **kube-proxy**: Network proxy for service routing
- **Container Runtime**: The software that runs containers (containerd, CRI-O)

### Key Resources

#### Pods
The smallest deployable unit in Kubernetes. A pod encapsulates one or more containers that share storage and network:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  containers:
  - name: web
    image: myapp:v2.1.0
    ports:
    - containerPort: 3000
    resources:
      requests:
        memory: "128Mi"
        cpu: "250m"
      limits:
        memory: "256Mi"
        cpu: "500m"
```

#### Deployments
Manage the lifecycle of pods, enabling rolling updates and rollbacks:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: myapp:v2.1.0
        ports:
        - containerPort: 3000
```

#### Services
Provide stable networking for pods, enabling service discovery and load balancing:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

### Service Types
- **ClusterIP**: Internal access only (default)
- **NodePort**: Expose on each node's IP at a static port
- **LoadBalancer**: Provision an external load balancer (cloud provider)
- **ExternalName**: Map to an external DNS name

## Scaling and Auto-scaling

### Horizontal Pod Autoscaler (HPA)
Automatically scales pod replicas based on metrics:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-deployment
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Cluster Autoscaler
Automatically adjusts the number of nodes in the cluster based on pod scheduling needs and resource utilization.

## Helm: The Kubernetes Package Manager

Helm simplifies deploying and managing Kubernetes applications through charts:

```bash
# Install a chart
helm install my-release bitnami/postgresql

# Upgrade with custom values
helm upgrade my-release bitnami/postgresql -f values.yaml

# Rollback to previous version
helm rollback my-release 1
```

## Monitoring and Observability

Essential monitoring stack for Kubernetes:

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization dashboards
- **Jaeger**: Distributed tracing
- **Fluentd/Fluent Bit**: Log aggregation
- **Loki**: Log storage and querying

## Resource Management Best Practices

1. Always set resource requests and limits for every container
2. Use LimitRanges to enforce defaults at the namespace level
3. Implement ResourceQuotas to prevent resource overconsumption
4. Use pod disruption budgets (PDBs) to maintain availability during disruptions
5. Configure liveness and readiness probes for automatic health monitoring
6. Use namespaces for multi-tenant isolation and resource allocation
