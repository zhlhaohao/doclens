# Git Branching and Workflow Strategies

## Understanding Git Branching Models

Git's branching model is one of its most powerful features, enabling parallel development streams that can be merged back together. However, without a well-defined workflow, branching can lead to merge conflicts, lost work, and confusion. This guide covers the most effective branching strategies and when to use them.

## Git Flow

Git Flow is the most established branching model, introduced by Vincent Driessen in 2010. It defines strict roles for different branches:

### Branch Types
- **main**: Production-ready code, only merged from release or hotfix branches
- **develop**: Integration branch for features, contains the latest delivered changes
- **feature/***: Branches for new features, branched from develop
- **release/***: Preparation branches for new production releases
- **hotfix/***: Urgent fixes for production issues, branched from main

### Workflow
```
main ──────────────────────────x──────────x──────
                               /          /
develop ────x────x────x───x──/──────x──/
           /    /    /    /
feature/A─x    /    /    /
              /    /    /
feature/B────x    /    /
                   /    /
feature/C─────────x    /
                        /
release/1.0───────────x
```

### When to Use Git Flow
- Projects with scheduled releases (weekly, monthly)
- Teams that need strict control over what goes into production
- Projects with long-lived feature branches
- Software with distinct versions (desktop apps, libraries)

## GitHub Flow

A simpler model optimized for continuous deployment:

### Branch Types
- **main**: Always deployable, protected branch
- **feature/***: Short-lived branches for all changes

### Workflow
1. Create a branch from main
2. Make changes and commit regularly
3. Open a pull request when ready for review
4. Discuss, review, and iterate on the code
5. Merge to main only after approval
6. Deploy immediately after merge

### Advantages
- Simplicity: Only two types of branches
- Fast feedback: PRs enable code review and discussion
- Continuous deployment: main is always deployable
- Reduced merge conflicts: Short-lived branches minimize divergence

## Trunk-Based Development

The simplest model, where all developers commit to a single branch (trunk/main):

### Rules
- All work happens on main or very short-lived branches (< 1 day)
- Feature flags control incomplete features
- Automated testing must be comprehensive
- Small, incremental commits are essential

### Feature Flags
Feature flags are essential for trunk-based development:

```python
# Using a feature flag to control incomplete functionality
if feature_flags.is_enabled("new_checkout_flow"):
    return new_checkout_process(cart)
else:
    return legacy_checkout_process(cart)
```

Feature flag management systems (LaunchDarkly, Unleash, Flagsmith) provide runtime control over feature visibility without code changes.

## Rebase vs Merge

One of the most debated topics in Git workflow is whether to use rebase or merge for integrating changes.

### Merge
```
# Creates a merge commit preserving full history
git checkout main
git merge feature/new-api
```

Advantages:
- Preserves complete history and context
- Non-destructive: existing commits are never modified
- Represents the actual sequence of events

Disadvantages:
- Can create complex branch topology
- Merge commits add noise to the history
- Bisecting through merge commits can be confusing

### Rebase
```
# Replays commits on top of the target branch
git checkout feature/new-api
git rebase main
```

Advantages:
- Linear history that is easy to read
- No merge commits to clutter the log
- Cleaner git bisect experience

Disadvantages:
- Rewrites commit history (dangerous for shared branches)
- Loses the context of when branches were created and merged
- Can cause issues if multiple developers work on the same branch

### Recommendation
- Use **rebase** for local feature branches before creating a PR
- Use **merge** (via pull request) for integrating into shared branches
- Never rebase commits that have been pushed and shared with others

## CI/CD Integration

### Branch Protection Rules
Configure branch protection on your Git hosting platform:

- Require pull request reviews (at least 1-2 approvals)
- Require status checks to pass (CI tests, linting, builds)
- Require signed commits for security
- Require linear history (no merge commits on main)
- Disallow force pushes
- Require conversation resolution before merging

### CI Pipeline Configuration
A typical CI pipeline triggered on pull requests:

```yaml
# .github/workflows/ci.yml
name: CI Pipeline
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: pip install -r requirements.txt
    - run: pytest --cov=src --cov-fail-under=80
    - run: ruff check src/
    - run: mypy src/

  integration:
    needs: test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
    - uses: actions/checkout@v4
    - run: pytest tests/integration/
```

## Commit Message Conventions

### Conventional Commits
The Conventional Commits specification provides a standardized format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

Examples:
```
feat(api): add pagination to user listing endpoint
fix(auth): resolve session expiration edge case
perf(db): optimize query for dashboard aggregation
```

Benefits:
- Automated changelog generation
- Semantic versioning automation
- Easier git log searching and filtering
