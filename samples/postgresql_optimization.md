# PostgreSQL Performance Optimization: A Practical Guide

## Why Performance Matters

PostgreSQL is one of the most capable open-source relational databases, but its default configuration is optimized for minimal resource usage rather than maximum performance. Understanding how to optimize PostgreSQL can mean the difference between a query taking 50 milliseconds and 50 seconds.

## Index Strategy

### Understanding Index Types
PostgreSQL offers multiple index types, each suited to different query patterns:

#### B-Tree Indexes (Default)
The standard index type, optimal for equality and range queries:

```sql
-- Simple index
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Composite index (column order matters!)
CREATE INDEX idx_orders_customer_date ON orders(customer_id, created_at);

-- Partial index (index only relevant rows)
CREATE INDEX idx_orders_active ON orders(created_at)
WHERE status = 'active';
```

#### GIN Indexes (Generalized Inverted Index)
Ideal for full-text search, JSONB, and array operations:

```sql
-- Full-text search
CREATE INDEX idx_articles_search ON articles
USING GIN(to_tsvector('english', title || ' ' || body));

-- JSONB indexing
CREATE INDEX idx_events_data ON events USING GIN(data jsonb_path_ops);

-- Array containment
CREATE INDEX idx_tags_array ON posts USING GIN(tags);
```

#### BRIN Indexes (Block Range Index)
Efficient for large tables with naturally ordered data:

```sql
-- Timestamp-ordered data (10x smaller than B-tree)
CREATE INDEX idx_logs_timestamp ON logs USING BRIN(created_at)
WITH (pages_per_range = 32);
```

### Index Design Principles

1. **Match query patterns**: Create indexes that directly support your most frequent and slowest queries
2. **Column order in composite indexes**: Place equality columns before range columns (the left-prefix rule)
3. **Avoid over-indexing**: Each index slows writes by 5-10% and consumes disk space
4. **Monitor index usage**: Regularly check for unused indexes

```sql
-- Find unused indexes
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Query Optimization

### EXPLAIN ANALYZE
The most important tool for query optimization:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.created_at > '2025-01-01'
ORDER BY o.total DESC
LIMIT 50;
```

Key output indicators:
- **Seq Scan**: Full table scan — often indicates a missing index
- **Index Scan**: Using an index — generally good
- **Bitmap Heap Scan**: Using an index with multiple result rows
- **Nested Loop**: May be efficient for small result sets
- **Hash Join**: Good for large joins with equality conditions
- **Merge Join**: Efficient for pre-sorted data

### Common Query Anti-Patterns

#### Sargability Violations
Functions on indexed columns prevent index usage:

```sql
-- BAD: Function prevents index usage
SELECT * FROM orders WHERE DATE(created_at) = '2025-01-15';

-- GOOD: Range query uses index
SELECT * FROM orders
WHERE created_at >= '2025-01-15' AND created_at < '2025-01-16';
```

#### OR Conditions
OR conditions can prevent efficient index usage:

```sql
-- BAD: OR condition may cause full scan
SELECT * FROM users WHERE email = 'test@example.com' OR username = 'test';

-- GOOD: UNION ALL with separate indexes
SELECT * FROM users WHERE email = 'test@example.com'
UNION ALL
SELECT * FROM users WHERE username = 'test' AND email != 'test@example.com';
```

#### Subquery Optimization
Rewrite correlated subqueries as joins:

```sql
-- BAD: Correlated subquery runs per row
SELECT *, (SELECT COUNT(*) FROM orders WHERE customer_id = c.id)
FROM customers c;

-- GOOD: Join with aggregation
SELECT c.*, COALESCE(o.order_count, 0)
FROM customers c
LEFT JOIN LATERAL (
    SELECT COUNT(*) as order_count
    FROM orders WHERE customer_id = c.id
) o ON true;
```

## Configuration Tuning

### Memory Settings
```ini
# postgresql.conf - key performance parameters

# Shared buffer cache (typically 25% of RAM)
shared_buffers = 4GB

# Query working memory per operation
work_mem = 64MB

# Maintenance operations (VACUUM, CREATE INDEX)
maintenance_work_mem = 512MB

# WAL write buffer
wal_buffers = 64MB

# Effective cache size (hint to planner, typically 75% of RAM)
effective_cache_size = 12GB
```

### WAL and Checkpoint Tuning
```ini
# Write-ahead log settings
wal_level = replica
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9
```

### Planner Cost Settings
```ini
# Query planner cost parameters
random_page_cost = 1.1    # Lower for SSD (default 4.0 for HDD)
effective_io_concurrency = 200  # For SSD storage
max_parallel_workers_per_gather = 4
```

## Table Maintenance

### VACUUM Strategy
PostgreSQL uses MVCC (Multi-Version Concurrency Control), which creates dead tuples on UPDATE and DELETE. Regular vacuuming is essential:

```sql
-- Check table bloat
SELECT schemaname, relname,
       n_live_tup, n_dead_tup,
       ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

Configure autovacuum for high-update tables:

```sql
ALTER TABLE high_update_table SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_cost_delay = 10
);
```

### Partitioning
For large tables (10M+ rows), partitioning can dramatically improve query performance:

```sql
-- Range partitioning by date
CREATE TABLE measurements (
    id BIGINT,
    sensor_id INTEGER,
    value DOUBLE PRECISION,
    recorded_at TIMESTAMP
) PARTITION BY RANGE (recorded_at);

-- Monthly partitions
CREATE TABLE measurements_2025_01 PARTITION OF measurements
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE measurements_2025_02 PARTITION OF measurements
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

## Connection Pooling

Direct PostgreSQL connections are expensive (5-10MB per connection). Use a connection pooler:

- **PgBouncer**: Lightweight, supports thousands of connections
- **Pgpool-II**: More features, including load balancing and replication
- **Supabase/Postgres.js**: Application-level pooling

Recommended pool sizes:
- **Maximum connections**: CPU cores * 2 + number of disks
- **Pool size per application instance**: 10-20 connections
- **PgBouncer max_client_conn**: 1000+
