# Bug Fix Skill

> Teaches the Agent how to analyze, diagnose, and fix bugs reported via GitHub Issues.

## When to Use This Skill

Activate this skill when:
- A GitHub Issue describes a **reproducible bug**
- There is a **clear failure behavior** (crash, wrong output, unexpected behavior)
- The issue includes steps to reproduce or error messages
- Labels include: `bug`, `bugfix`, `fix`, `defect`

Do NOT use this skill for:
- Feature requests
- Questions or support inquiries
- Performance improvements without clear bugs
- Refactoring requests

## How to Act

### Phase 1: Understand the Bug

1. **Read the issue carefully**
   - What is the expected behavior?
   - What is the actual behavior?
   - Are there steps to reproduce?
   - Are there error messages or stack traces?

2. **Gather context**
   - Use `github.getFileContent` to read relevant source files
   - Use `github.listFiles` to explore the codebase structure
   - Look for related tests or documentation

3. **Identify the root cause**
   - Don't fix symptoms, fix causes
   - Consider edge cases that might have been missed
   - Check for similar patterns elsewhere that might have the same bug

### Phase 2: Propose a Fix

1. **Design a minimal fix**
   - Change only what's necessary to fix the bug
   - Preserve existing behavior for other cases
   - Follow existing code patterns and style

2. **Consider side effects**
   - Will this change break anything else?
   - Are there tests that need updating?
   - Should new tests be added?

### Phase 3: Implement and Submit

1. **Create the fix**
   - Use `fs.writeFile` to create or modify files
   - Follow repository conventions (formatting, naming, etc.)

2. **Open a Pull Request**
   - Use `github.createPullRequest` with:
     - Clear title: `fix: <short description>`
     - Body referencing the issue: `Fixes #<issue_number>`
     - Description of the fix and why it works

3. **Add a comment to the issue**
   - Use `github.createComment` to inform the reporter
   - Explain what was found and how it's being fixed

## Do NOT

- ❌ Refactor unrelated code
- ❌ Change public APIs unless absolutely necessary
- ❌ Add new features as part of a bug fix
- ❌ Make stylistic changes outside the fix scope
- ❌ Ignore existing tests (update them if needed)
- ❌ Create breaking changes without explicit approval

## Quality Checklist

Before submitting a fix, verify:

- [ ] The fix addresses the root cause, not just symptoms
- [ ] Existing tests still pass
- [ ] New tests cover the bug scenario (when appropriate)
- [ ] Code follows repository conventions
- [ ] PR description clearly explains the fix
- [ ] The issue is referenced in the PR

## Tool Usage Guide

| Task | Tool | Example |
|------|------|---------|
| Read source code | `github.getFileContent` | `{owner, repo, path: "src/utils.ts"}` |
| List directory | `github.listFiles` | `{owner, repo, path: "src/"}` |
| Create PR | `github.createPullRequest` | `{owner, repo, title, body, head, base}` |
| Comment on issue | `github.createComment` | `{owner, repo, issueNumber, body}` |
| Write local file | `fs.writeFile` | `{path: "/tmp/fix.ts", content: "..."}` |

## Success Criteria

A bug fix is successful when:
1. The reported behavior no longer occurs
2. No new bugs are introduced
3. The fix is minimal and focused
4. Code quality is maintained or improved
5. The reporter is informed of the fix
