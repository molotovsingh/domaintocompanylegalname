# Architectural Decisions

This folder documents key decisions made during the project's development.

## Purpose

To record:
- **What** was decided
- **Why** it was decided 
- **When** the decision was made
- **Who** was involved
- **Alternatives** considered

## Format

Each decision should be documented as:

```markdown
# Decision: [Brief Title]
Date: YYYY-MM-DD
Status: Accepted/Deprecated/Superseded

## Context
What situation or problem led to this decision?

## Decision
What was decided?

## Rationale
Why was this chosen over alternatives?

## Alternatives Considered
What other options were evaluated?

## Consequences
What are the implications of this decision?
```

## Examples

- Choosing PostgreSQL over MongoDB for persistence
- Implementing GLEIF integration as Level 2 enhancement
- Using domain hashing for unique identification
- Separating beta testing into isolated database