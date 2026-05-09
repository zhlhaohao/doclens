# Python Async Programming Guide: Mastering asyncio

## Introduction to Asynchronous Python

Asynchronous programming in Python has evolved from a niche concept to a mainstream paradigm. The `asyncio` module, introduced in Python 3.4 and significantly enhanced in subsequent versions, provides a robust framework for writing concurrent code using the async/await syntax.

Asynchronous programming is particularly valuable for I/O-bound tasks where the program spends significant time waiting for external operations — network requests, database queries, file operations, and API calls. Instead of blocking the entire program while waiting, async code can switch to other tasks, dramatically improving throughput.

## Core Concepts

### Event Loop
The event loop is the heart of asyncio. It schedules and executes asynchronous tasks, manages I/O callbacks, and handles timers. Understanding the event loop is essential for writing effective async code:

```python
import asyncio

async def main():
    print("Hello")
    await asyncio.sleep(1)
    print("World")

asyncio.run(main())
```

The `asyncio.run()` function creates a new event loop, runs the coroutine, and closes the loop. Under the hood, it handles the lifecycle management that would otherwise require manual setup.

### Coroutines
Coroutines are functions defined with `async def` that can be paused and resumed. They are the building blocks of async Python:

```python
async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
```

Coroutines do not execute when called — they return a coroutine object that must be awaited or scheduled on the event loop.

### Tasks
Tasks are wrappers around coroutines that schedule their execution on the event loop:

```python
import asyncio

async def download(url: str) -> str:
    await asyncio.sleep(2)  # Simulate network delay
    return f"Content from {url}"

async def main():
    # Create tasks for concurrent execution
    tasks = [
        asyncio.create_task(download("https://api.example.com/1")),
        asyncio.create_task(download("https://api.example.com/2")),
        asyncio.create_task(download("https://api.example.com/3")),
    ]
    results = await asyncio.gather(*tasks)
    print(results)

asyncio.run(main())
```

This pattern enables true concurrency — all three downloads happen simultaneously, reducing total time from 6 seconds to approximately 2 seconds.

## Practical Patterns

### Rate Limiting
When making many API requests, rate limiting is essential:

```python
async def rate_limited_fetch(urls: list, max_concurrent: int = 10):
    semaphore = asyncio.Semaphore(max_concurrent)

    async def fetch_with_limit(url):
        async with semaphore:
            return await fetch_data(url)

    tasks = [fetch_with_limit(url) for url in urls]
    return await asyncio.gather(*tasks)
```

### Timeout Handling
Prevent hanging operations with timeouts:

```python
async def fetch_with_timeout(url: str, timeout: float = 5.0):
    try:
        return await asyncio.wait_for(fetch_data(url), timeout=timeout)
    except asyncio.TimeoutError:
        return {"error": "Request timed out"}
```

### Background Tasks
Run operations in the background while the main task continues:

```python
async def process_with_logging(data):
    async def log_completion(result):
        await write_to_log(result)

    result = await process_data(data)
    asyncio.create_task(log_completion(result))
    return result
```

## Common Pitfalls

### Blocking the Event Loop
The most common mistake in async Python is calling blocking I/O operations that freeze the event loop:

```python
# BAD: Blocks the event loop
import time
async def bad_example():
    time.sleep(5)  # Blocks ALL coroutines

# GOOD: Use async-compatible alternatives
async def good_example():
    await asyncio.sleep(5)  # Non-blocking

# GOOD: Run blocking code in a thread pool
async def blocking_in_thread():
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, blocking_function)
```

### Forgetting to Await
A coroutine that is not awaited will not execute, and Python will issue a warning:

```python
async def problematic():
    fetch_data("https://api.example.com")  # Warning: coroutine was never awaited
    # The function call creates a coroutine object but never runs it
```

### Mixing Sync and Async Code
Libraries that do not support async will block the event loop. Use `asyncio.to_thread()` (Python 3.9+) or `run_in_executor()` to wrap synchronous calls:

```python
import requests  # Synchronous library

async def fetch_with_requests(url):
    # Run synchronous requests in a thread pool
    response = await asyncio.to_thread(requests.get, url)
    return response.json()
```

## Performance Comparison

A benchmark comparing sync vs async for 100 HTTP requests:

| Approach | Total Time | CPU Usage | Concurrency |
|----------|-----------|-----------|-------------|
| Sequential (requests) | 50 seconds | 5% | 1 |
| ThreadPool (10 workers) | 5.5 seconds | 30% | 10 |
| Asyncio + aiohttp | 2.1 seconds | 15% | 100 |
| Asyncio + httpx (100 limit) | 1.8 seconds | 20% | 100 |

## Ecosystem

Key async-compatible libraries for Python:

- **httpx**: Async HTTP client (replaces requests)
- **aiohttp**: Async HTTP client/server framework
- **SQLAlchemy 2.0+**: Native async ORM support
- **asyncpg**: Async PostgreSQL driver
- **aiomysql / aioredis**: Async database drivers
- **FastAPI**: Async web framework built on Starlette
- **aiofiles**: Async file I/O
- **asyncio.Queue**: Async producer-consumer pattern

## Best Practices

1. Use `asyncio.run()` as the entry point — avoid manually managing event loops
2. Always use async-compatible libraries for I/O operations within async code
3. Use `asyncio.gather()` for concurrent execution and `asyncio.TaskGroup` (Python 3.11+) for structured concurrency
4. Set appropriate timeouts to prevent indefinite waiting
5. Use semaphores to limit concurrency and avoid overwhelming external services
6. Handle exceptions properly — use `return_exceptions=True` in gather() or wrap individual tasks
7. Profile with `asyncio.debug = True` to detect blocking calls during development
