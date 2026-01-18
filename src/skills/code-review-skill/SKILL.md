# Code Review Skill

> Teaches the Agent how to review pull requests, analyze code changes, and provide constructive feedback.

## When to Use This Skill

Activate this skill when:
- A **Pull Request** is created or updated
- A PR has the label: `review`, `needs-review`, `code-review`
- Someone requests a review on a PR

Do NOT use this skill for:
- Bug fix issues (use bugfix-skill instead)
- Feature requests without code changes
- Documentation-only changes (unless they need technical review)

## How to Act

### Phase 1: Understand the PR Context

1. **Read the PR description**
   - What is the purpose of this PR?
   - What problem does it solve?
   - Are there any special considerations mentioned?

2. **Get PR details**
   - Use `github_getPullRequest` to get PR metadata
   - Note the source and target branches
   - Check who authored the PR

3. **List changed files**
   - Use `github_listPullRequestFiles` to see all changes
   - Understand the scope: how many files? How many lines changed?
   - Identify the types of files (source code, tests, config, docs)

### Phase 2: Analyze the Code Changes

1. **Review the diff**
   - Use `github_getPullRequestDiff` for the full diff
   - Or examine individual file patches from `github_listPullRequestFiles`

2. **Check for code quality issues**
   - **Logic errors**: Bugs, edge cases, race conditions
   - **Security issues**: Injection, XSS, sensitive data exposure
   - **Performance**: Inefficient algorithms, unnecessary loops, memory leaks
   - **Maintainability**: Code clarity, naming, duplication
   - **Best practices**: Language idioms, design patterns

3. **Verify completeness**
   - Are there tests for new functionality?
   - Is error handling adequate?
   - Are edge cases covered?

4. **Check consistency**
   - Does the code follow existing patterns in the codebase?
   - Is the style consistent with the project?

### Phase 3: Provide Feedback

1. **Decide the review outcome**
   - **APPROVE**: Code is good, ready to merge
   - **COMMENT**: Feedback provided, no blocking issues
   - **REQUEST_CHANGES**: Issues must be addressed before merge

2. **Write the review**
   - Use `github_createPullRequestReview` with appropriate event type
   - Structure feedback clearly with sections
   - Be constructive and specific
   - Include code suggestions when helpful

3. **Review comment structure**
   ```markdown
   ## Summary
   [Brief overview of the PR and your assessment]

   ## What's Good
   - [Positive aspects of the changes]

   ## Suggestions
   - [Non-blocking improvements]

   ## Issues (if REQUEST_CHANGES)
   - [Blocking issues that must be fixed]

   ## Verdict
   [APPROVED / CHANGES REQUESTED / COMMENTED]
   ```

## Review Criteria

### Must Check (Blocking Issues)

| Category | What to Look For |
|----------|------------------|
| **Security** | SQL injection, XSS, auth bypass, secrets in code |
| **Correctness** | Logic errors, null references, type mismatches |
| **Breaking Changes** | API changes, backwards compatibility |
| **Data Integrity** | Data loss, corruption, invalid states |

### Should Check (Important)

| Category | What to Look For |
|----------|------------------|
| **Error Handling** | Missing try-catch, unhandled promises |
| **Edge Cases** | Empty arrays, null values, boundary conditions |
| **Tests** | Test coverage for new code |
| **Documentation** | Updated docs for API changes |

### Nice to Check (Suggestions)

| Category | What to Look For |
|----------|------------------|
| **Performance** | Optimization opportunities |
| **Readability** | Variable names, code structure |
| **DRY** | Code duplication |
| **Style** | Formatting, conventions |

## Do NOT

- ❌ Be harsh or dismissive
- ❌ Focus only on style/formatting
- ❌ Request changes for minor style preferences
- ❌ Approve without actually reading the code
- ❌ Block PRs for non-critical issues
- ❌ Rewrite the author's entire approach (suggest alternatives instead)

## Do

- ✅ Be constructive and respectful
- ✅ Explain WHY something is an issue
- ✅ Provide specific suggestions or examples
- ✅ Acknowledge good code and improvements
- ✅ Prioritize issues by severity
- ✅ Ask questions if something is unclear

## Tool Usage Guide

| Task | Tool | Example |
|------|------|---------|
| Get PR details | `github_getPullRequest` | `{owner, repo, pullNumber: 42}` |
| List changed files | `github_listPullRequestFiles` | `{owner, repo, pullNumber: 42}` |
| Get full diff | `github_getPullRequestDiff` | `{owner, repo, pullNumber: 42}` |
| Read source file | `github_getFileContent` | `{owner, repo, path: "src/file.ts", ref: "branch"}` |
| Submit review | `github_createPullRequestReview` | `{owner, repo, pullNumber, body, event: "APPROVE"}` |
| Add comment | `github_createComment` | `{owner, repo, issueNumber, body}` |

## Review Event Types

| Event | When to Use |
|-------|-------------|
| `APPROVE` | Code is good, no issues found, ready to merge |
| `COMMENT` | Feedback provided but no blocking issues; author can merge |
| `REQUEST_CHANGES` | Critical issues found that must be fixed before merge |

## Success Criteria

A code review is successful when:
1. All critical issues are identified
2. Feedback is clear and actionable
3. The review is constructive and respectful
4. The author understands what changes are needed (if any)
5. The codebase quality is maintained or improved
