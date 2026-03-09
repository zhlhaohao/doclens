# Contributing to TreeSearch

Thank you for your interest in contributing to TreeSearch!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/shibing624/TreeSearch.git
cd TreeSearch

# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest tests/ -v
```

## Code Style

- Follow PEP 8 conventions
- Use type hints for all public functions
- Add docstrings (Google style) to all public classes and functions
- Keep imports organized: stdlib → third-party → local

## Testing

- All new features must include tests
- Mock LLM calls in tests (never use real API keys in CI)
- Run the full test suite before submitting:

```bash
pytest tests/ -v --tb=short
```

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit a PR with a clear description of changes

## Reporting Issues

- Use [GitHub Issues](https://github.com/shibing624/TreeSearch/issues)
- Include reproduction steps, expected vs actual behavior, and Python version

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
