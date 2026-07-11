<!--
Sync Impact Report
- Version change: template → 1.0.0
- Modified principles: none; initial constitution established with five principles.
- Added sections: Refactoring Constraints; Required Refactoring Workflow.
- Removed sections: none.
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ README.md
  - ✅ CLAUDE.md
  - ✅ .specify/templates/commands/ (directory absent; no command templates to update)
- Follow-up TODOs: none.
-->

# RSS Reader Constitution

## Core Principles

### I. Observable Behavior Is the Baseline

Existing observable business behavior MUST remain unchanged by default. Any intended
behavior change MUST be described and approved in a separate feature specification;
it MUST NOT be embedded in a refactoring specification. A refactoring specification
MUST cover exactly one business capability, one architectural boundary, or one
end-to-end call chain. This keeps regression investigation and product decisions
separable.

### II. Incremental, Testable, and Reversible Change

The system MUST NOT be rewritten in one step. Each refactoring increment MUST be
independently testable, independently committable, and independently reversible.
Every increment MUST state the pre-migration state, post-migration state, and
rollback procedure. File relocation alone is not an architectural improvement; an
increment MUST reduce coupling or correct a dependency direction.

### III. Evidence Before High-Risk Change

Before changing high-risk code, maintainers MUST add or identify a feature test or
regression test that captures the current behavior. Old code MUST NOT be removed
until all callers have been located and proven migrated. Completion requires a
traceable consistency check across the specification, plan, tasks, tests, and code.
This prevents a cleaner-looking implementation from silently changing data, IPC,
sync, or reader behavior.

### IV. Target Direction Without Legacy Expansion

New code MUST follow the dependency direction defined by the target architecture for
the increment. Legacy code MAY remain temporarily, but new changes MUST NOT expand
its incorrect dependencies or introduce new consumers of deprecated paths. Any
boundary crossing during migration MUST use a compatibility layer, adapter, or an
explicitly documented switch mechanism.

### V. Deliberate Reuse and Recorded Trade-offs

Before introducing an abstraction, maintainers MUST search the repository for an
existing implementation and document why it cannot be reused or adapted. Every
architectural decision MUST record its rationale, considered alternatives, and
costs. This avoids duplicate capabilities and makes migration trade-offs reviewable
after the immediate refactor is complete.

## Refactoring Constraints

- A refactoring specification MUST list its sole scope unit, its explicit non-goals,
  and any separate feature specifications required for behavior changes.
- A plan MUST identify the current callers, the current dependency direction, the
  target dependency direction, and the compatibility or cutover path.
- High-risk areas include persisted SQLite data and migrations, IPC contracts and
  preload exposure, RSS synchronization and network behavior, reader rendering and
  sanitization, and any externally observable keyboard, routing, or preference
  behavior. The plan MUST justify any additional or narrower classification.
- A migration MUST preserve a compatible path until consumers have moved, unless a
  separately approved breaking-change specification defines the cutover.
- A deletion task MUST cite evidence that all callers have migrated. Search results
  alone are insufficient when runtime registration, IPC channel names, dynamic
  imports, or persisted data can create callers.

## Required Refactoring Workflow

1. Write the scope unit, non-goals, observable baseline, and any separate behavior
   change specification.
2. Search for existing implementations and callers; record the dependency and
   compatibility findings in the plan.
3. Add or identify the required feature/regression tests before modifying high-risk
   code.
4. Plan one reversible increment at a time, including its compatibility layer or
   switch, migration states, rollback, and decision record.
5. Implement and commit each increment independently; do not mix unrelated product
   work into the refactor.
6. Before completion, reconcile the specification, plan, tasks, tests, and code;
   record any intentional deviation and its approval.

## Governance

This constitution supersedes conflicting refactoring practices in repository
guidance, templates, plans, and tasks. Reviewers MUST reject a refactoring that
lacks scope boundaries, rollback information, required high-risk test evidence, or
dependency-direction evidence.

Amendments MUST be made in this file with a Sync Impact Report and propagated to
affected templates and guidance in the same change. Versioning follows semantic
versioning: MAJOR for incompatible removal or redefinition of a principle, MINOR
for a new principle or materially expanded mandatory rule, and PATCH for clarifying
wording that preserves governance meaning. Each plan MUST perform the Constitution
Check before research and again after design; implementation completion MUST include
the consistency review required by Principle III.

**Version**: 1.0.0 | **Ratified**: 2026-07-11 | **Last Amended**: 2026-07-11
