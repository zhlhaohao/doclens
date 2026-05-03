# RESTful API Design Best Practices

## Principles of REST Architecture

REST (Representational State Transfer) is an architectural style for designing networked applications. A well-designed REST API is intuitive, consistent, and easy to consume. This guide covers the essential principles and patterns for building production-quality REST APIs.

## Resource Naming Conventions

### Use Nouns, Not Verbs
The URL should represent a resource (noun), and the HTTP method should represent the action (verb):

```
# GOOD
GET    /users          - List users
POST   /users          - Create a user
GET    /users/123      - Get user 123
PUT    /users/123      - Update user 123
DELETE /users/123      - Delete user 123

# BAD - Using verbs in URLs
GET    /getUsers
POST   /createUser
PUT    /updateUser/123
DELETE /deleteUser/123
```

### Plural Nouns for Collections
```
# GOOD
GET /users
GET /users/123/orders

# BAD
GET /user
GET /user/123/order
```

### Nested Resources
Express relationships through nesting:

```
GET    /users/123/orders              - List orders for user 123
POST   /users/123/orders              - Create order for user 123
GET    /users/123/orders/456          - Get order 456 of user 123
```

Keep nesting to a maximum of 2-3 levels. For deeper relationships, use query parameters:

```
GET /orders?user_id=123&status=active
```

## HTTP Methods

### Proper Method Usage

| Method | Idempotent | Safe | Use Case |
|--------|-----------|------|----------|
| GET | Yes | Yes | Retrieve resource(s) |
| POST | No | No | Create resource, trigger action |
| PUT | Yes | No | Full resource replacement |
| PATCH | No | No | Partial resource update |
| DELETE | Yes | No | Remove resource |
| HEAD | Yes | Yes | Get headers only (check existence) |
| OPTIONS | Yes | Yes | Get supported methods (CORS) |

### PUT vs PATCH
```json
// PUT /users/123 - Full replacement (must send all fields)
{
    "name": "Alice",
    "email": "alice@example.com",
    "age": 31
}

// PATCH /users/123 - Partial update (only changed fields)
{
    "age": 31
}
```

## HTTP Status Codes

### Success Codes (2xx)
- **200 OK**: Successful GET, PUT, PATCH, or DELETE
- **201 Created**: Successful POST (include Location header)
- **202 Accepted**: Request accepted for asynchronous processing
- **204 No Content**: Successful DELETE or PUT with no response body

### Client Error Codes (4xx)
- **400 Bad Request**: Malformed request syntax, invalid data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Authenticated but not authorized
- **404 Not Found**: Resource does not exist
- **409 Conflict**: Request conflicts with current state (duplicate, version conflict)
- **422 Unprocessable Entity**: Valid syntax but semantic errors (validation failures)
- **429 Too Many Requests**: Rate limit exceeded

### Server Error Codes (5xx)
- **500 Internal Server Error**: Unexpected server failure
- **502 Bad Gateway**: Upstream server returned invalid response
- **503 Service Unavailable**: Server temporarily overloaded or in maintenance
- **504 Gateway Timeout**: Upstream server timeout

### Error Response Format
```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "The request body contains invalid fields",
        "details": [
            {
                "field": "email",
                "message": "Invalid email format",
                "value": "not-an-email"
            },
            {
                "field": "age",
                "message": "Must be a positive integer",
                "value": -5
            }
        ],
        "request_id": "req_abc123",
        "documentation_url": "https://api.example.com/docs/errors/VALIDATION_ERROR"
    }
}
```

## Pagination

### Cursor-Based Pagination (Recommended for large datasets)
```
GET /orders?cursor=eyJpZCI6MTAwfQ&limit=25

Response:
{
    "data": [...],
    "pagination": {
        "next_cursor": "eyJpZCI6MTI1fQ",
        "prev_cursor": "eyJpZCI6NzV9",
        "limit": 25,
        "has_more": true
    }
}
```

Advantages:
- Consistent performance regardless of page number
- No skipped or duplicated results from inserts/deletes
- Works efficiently with large datasets (millions of records)

### Offset-Based Pagination (Simpler but less efficient)
```
GET /orders?page=3&per_page=25

Response:
{
    "data": [...],
    "meta": {
        "page": 3,
        "per_page": 25,
        "total": 1250,
        "total_pages": 50
    },
    "links": {
        "self": "/orders?page=3&per_page=25",
        "next": "/orders?page=4&per_page=25",
        "prev": "/orders?page=2&per_page=25",
        "first": "/orders?page=1&per_page=25",
        "last": "/orders?page=50&per_page=25"
    }
}
```

## Filtering, Sorting, and Field Selection

### Filtering
```
GET /orders?status=active&created_after=2025-01-01&total_min=100
GET /users?role=admin,moderator    # Multi-value filter
```

### Sorting
```
GET /orders?sort=-created_at,total  # - prefix for descending
```

### Field Selection (Sparse Fieldsets)
```
GET /users?fields=id,name,email    # Only return specified fields
```

## Versioning

### URL Path Versioning (Most Common)
```
GET /v1/users
GET /v2/users
```

### Header Versioning
```
GET /users
Accept: application/vnd.api.v2+json
```

### Version Lifecycle
- Maintain at most 2 active versions simultaneously
- Provide at least 6 months deprecation notice
- Include sunset date in response headers:
```
Sunset: Sat, 01 Jan 2026 00:00:00 GMT
Deprecation: true
Link: </v2/users>; rel="successor-version"
```

## Rate Limiting

### Response Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1717237200
Retry-After: 30                        # Included with 429 responses
```

### Rate Limit Tiers
| Tier | Requests/minute | Burst | Use Case |
|------|----------------|-------|----------|
| Free | 60 | 10 | Development, testing |
| Standard | 600 | 50 | Production applications |
| Premium | 3000 | 200 | High-volume applications |
| Enterprise | Custom | Custom | Unlimited requirements |

## Caching

### ETags
```
# Response
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# Subsequent request
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
# Returns 304 Not Modified if content unchanged
```

### Cache-Control Headers
```
Cache-Control: public, max-age=300     # Cache for 5 minutes
Cache-Control: private, max-age=60     # Client-side only, 1 minute
Cache-Control: no-store                # Never cache (sensitive data)
```
