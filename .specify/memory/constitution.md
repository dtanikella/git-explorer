<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial constitution)
  
  Added Principles:
  - I. Test-First (TDD) — NON-NEGOTIABLE
  - II. Simplicity (YAGNI)
  - III. User Experience First
  - IV. Visual Clarity
  
  Added Sections:
  - Core Principles (4 principles)
  - Governance
  
  Removed Sections: None (initial creation)
  
  Templates requiring updates:
  - ✅ plan-template.md — Constitution Check section references principles
  - ✅ spec-template.md — No changes needed (already aligned)
  - ✅ tasks-template.md — No changes needed (already aligned)
  
  Follow-up TODOs: None
-->

# Git Explorer Constitution

## Core Principles

### I. Test-First (TDD) — NON-NEGOTIABLE

All features MUST follow Test-Driven Development. Tests are written before implementation, approved, and must fail before code is written.

- **Red-Green-Refactor**: Write failing test → implement minimal code to pass → refactor
- **No code without tests**: Every new feature, bug fix, or refactor starts with a test
- **Test coverage**: Unit tests for data transformation logic, component tests for UI, integration tests for data pipelines
- **Tests document behavior**: Tests serve as living documentation of expected behavior

**Rationale**: For a data visualization tool processing git data, correctness is paramount. TDD ensures the data pipeline and visualizations behave as expected and prevents regressions as the codebase grows.

### II. Simplicity (YAGNI)

Build only what is needed now. Avoid premature abstraction and over-engineering.

- **YAGNI**: You Aren't Gonna Need It — don't build features "just in case"
- **One way**: When possible, establish one clear way to accomplish a task
- **Minimal dependencies**: Add libraries only when they provide clear, immediate value
- **Delete aggressively**: Remove unused code, don't comment it out

**Rationale**: A simple codebase is easier to understand, test, and maintain. Complexity should be earned through proven necessity, not anticipated need.

### III. User Experience First

Every feature MUST prioritize the end-user experience. Visualizations exist to help users understand their codebase.

- **Intuitive interactions**: Users should not need documentation to understand basic functionality
- **Responsive feedback**: Loading states, progress indicators, and error messages must be clear
- **Performance matters**: Visualizations should feel fast; optimize perceived performance
- **Graceful degradation**: Handle edge cases (empty repos, large repos, errors) gracefully

**Rationale**: Git Explorer's value is in making git data understandable. A confusing or slow interface defeats the purpose, regardless of how accurate the underlying data is.

### IV. Visual Clarity

Data visualizations MUST communicate information clearly at a glance.

- **Story at a glance**: A visualization should convey its primary insight immediately
- **Progressive disclosure**: Show summary first, allow drill-down to details
- **Consistent visual language**: Colors, shapes, and patterns should have consistent meaning across the app
- **Reduce noise**: Remove unnecessary visual elements; every pixel should earn its place

**Rationale**: Effective data visualization reduces cognitive load. Users should spend time understanding their codebase, not deciphering charts.

## Governance

This constitution defines the non-negotiable principles for Git Explorer development. All contributions must align with these principles.

- **Constitution supersedes**: When in conflict, constitution principles take precedence over convenience
- **Amendments require justification**: Changes to this constitution must document the reasoning and impact
- **TDD is mandatory**: Principle I (Test-First) cannot be waived for expediency
- **Simplicity check**: New features should be evaluated against Principle II before implementation

**Version**: 1.0.0 | **Ratified**: 2026-01-31 | **Last Amended**: 2026-01-31
