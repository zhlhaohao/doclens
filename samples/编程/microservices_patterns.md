# Microservices Design Patterns

## Architectural Patterns for Distributed Systems

Microservices architecture decomposes applications into small, independently deployable services. While this approach offers scalability and organizational benefits, it introduces distributed system challenges that require specific design patterns to address.

## Pattern 1: CQRS (Command Query Responsibility Segregation)

### Problem
In a traditional CRUD architecture, the same data model serves both reads and writes. This leads to compromises — the read model may not be optimized for queries, and the write model may not efficiently handle complex business logic.

### Solution
CQRS separates the read and write sides into different models:

```
Write Side (Command Model):
Client -> Command -> Command Handler -> Write Model -> Event Store

Read Side (Query Model):
Event Store -> Event Handler -> Read Model (denormalized) -> Query -> Client
```

### Implementation Example
```python
# Write side - Command
class CreateOrderCommand:
    order_id: str
    customer_id: str
    items: list[OrderItem]

class OrderCommandHandler:
    def handle(self, command: CreateOrderCommand):
        order = Order(
            id=command.order_id,
            customer_id=command.customer_id,
            items=command.items,
            status="created"
        )
        self.order_repository.save(order)
        self.event_bus.publish(OrderCreatedEvent(order))

# Read side - Query
class OrderQueryService:
    def get_order_summary(self, order_id: str) -> OrderSummary:
        return self.read_db.query(
            "SELECT * FROM order_summaries WHERE id = %s",
            order_id
        )

    def get_customer_orders(self, customer_id: str) -> list[OrderList]:
        return self.read_db.query(
            "SELECT * FROM order_lists WHERE customer_id = %s",
            customer_id
        )
```

### When to Use CQRS
- High read-to-write ratio (e.g., 100:1)
- Complex business logic on the write side
- Need for different data representations for different consumers
- Event sourcing architecture

## Pattern 2: Saga Pattern

### Problem
In a monolith, a single database transaction ensures consistency. In microservices, operations span multiple services, each with its own database. How do you maintain data consistency across service boundaries without distributed transactions (which are impractical at scale)?

### Solution: Choreography-Based Saga
Each service publishes events that trigger the next step:

```
Order Service -> OrderCreated -> Payment Service
Payment Service -> PaymentCompleted -> Inventory Service
Inventory Service -> InventoryReserved -> Shipping Service
```

If any step fails, compensating transactions are triggered:

```
Inventory Service -> InventoryReservationFailed -> Payment Service
Payment Service -> PaymentRefunded -> Order Service
Order Service -> OrderCancelled
```

### Solution: Orchestration-Based Saga
A central orchestrator coordinates the saga:

```python
class OrderSagaOrchestrator:
    async def execute(self, order_id: str):
        saga = SagaBuilder.create() \
            .step("create_order") \
                .action(self.order_service.create, order_id) \
                .compensate(self.order_service.cancel, order_id) \
            .step("process_payment") \
                .action(self.payment_service.charge, order_id) \
                .compensate(self.payment_service.refund, order_id) \
            .step("reserve_inventory") \
                .action(self.inventory_service.reserve, order_id) \
                .compensate(self.inventory_service.release, order_id) \
            .step("schedule_shipping") \
                .action(self.shipping_service.schedule, order_id) \
                .compensate(self.shipping_service.cancel, order_id) \
            .build()

        await saga.execute()
```

### Comparison
| Aspect | Choreography | Orchestration |
|--------|-------------|---------------|
| Coupling | Loose | Moderate |
| Visibility | Low (hard to trace) | High (centralized) |
| Complexity | Distributed logic | Centralized logic |
| Scalability | Better | Good |
| Best for | Simple flows | Complex multi-step flows |

## Pattern 3: Circuit Breaker

### Problem
When a downstream service fails, callers continue sending requests, wasting resources and cascading failures throughout the system.

### Solution
The Circuit Breaker pattern monitors calls to a service and "trips" when failures exceed a threshold, preventing further calls:

```
CLOSED (normal) -> failure threshold exceeded -> OPEN (blocking)
OPEN -> timeout expired -> HALF-OPEN (testing)
HALF-OPEN -> test call succeeds -> CLOSED
HALF-OPEN -> test call fails -> OPEN
```

### Implementation
```python
import time
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=30, half_open_max=3):
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.last_failure_time = None
        self.half_open_successes = 0
        self.half_open_max = half_open_max

    def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > self.timeout:
                self.state = CircuitState.HALF_OPEN
                self.half_open_successes = 0
            else:
                raise CircuitOpenError("Circuit breaker is open")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_successes += 1
            if self.half_open_successes >= self.half_open_max:
                self.state = CircuitState.CLOSED
                self.failure_count = 0

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
```

## Pattern 4: API Gateway

### Problem
Clients need to call multiple services to assemble a single view. This leads to:
- Multiple network round trips
- Complex client-side logic
- Exposure of internal service structure

### Solution
An API Gateway serves as the single entry point, routing requests to appropriate services:

```
Client -> API Gateway -> Service A
                       -> Service B
                       -> Service C
```

### Gateway Responsibilities
- **Routing**: Route requests to the correct service
- **Authentication**: Centralized auth and authorization
- **Rate limiting**: Protect services from abuse
- **Request aggregation**: Combine responses from multiple services
- **Protocol translation**: REST to gRPC, HTTP to WebSocket
- **Caching**: Cache frequently requested data
- **Load balancing**: Distribute traffic across service instances

### Popular API Gateway Implementations
- **Kong**: Open-source, plugin-based architecture
- **Envoy**: High-performance L4/L7 proxy (used in Istio service mesh)
- **AWS API Gateway**: Managed service for AWS deployments
- **NGINX/HAProxy**: Traditional reverse proxies with gateway capabilities

## Pattern 5: Event Sourcing

### Problem
Traditional CRUD operations lose the history of state changes. If a bug occurs, there is no record of what the data looked like before the change.

### Solution
Instead of storing the current state, store the sequence of events that led to the current state:

```python
# Traditional: Only current state
UPDATE accounts SET balance = 90 WHERE id = 'A123';

# Event sourcing: Append-only event log
INSERT INTO events (aggregate_id, type, data, timestamp)
VALUES ('A123', 'AccountCreated', '{"initial_balance": 100}', '2025-01-01');
INSERT INTO events (aggregate_id, type, data, timestamp)
VALUES ('A123', 'MoneyWithdrawn', '{"amount": 10}', '2025-01-15');

# Reconstruct current state by replaying events
balance = sum(event.amount for event in events)
```

### Benefits
- Complete audit trail
- Time travel (reconstruct state at any point in time)
- Natural fit for CQRS architecture
- Enables temporal queries and analytics

## Pattern 6: Strangler Fig Pattern

### Problem
Migrating a monolith to microservices is risky. A "big bang" rewrite often fails.

### Solution
Gradually replace monolith components with microservices:

1. Identify a bounded context to extract
2. Route traffic for that context to the new service
3. Verify the new service works correctly
4. Repeat until the monolith is fully replaced

This incremental approach reduces risk and delivers value continuously throughout the migration.
