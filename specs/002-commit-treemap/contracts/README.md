# Contracts: Git Repository Commit Activity Treemap

**Feature**: 002-commit-treemap  
**Purpose**: Define interfaces between system components

## Contents

### 1. [api-git-analysis.md](api-git-analysis.md)

**Contract Type**: HTTP API  
**Endpoint**: `POST /api/git-analysis`

Defines the request/response contract for the git analysis API route:
- Request body schema (repository path, time range)
- Success response (tree data, metadata)
- Error responses (validation errors, git errors, permission errors)
- Status codes and error messages
- Performance expectations (<10s for 10k files)

**Used By**: Client-side fetch calls → Server API route

---

### 2. [components.md](components.md)

**Contract Type**: React Component Props  
**Components**: 5 UI components

Defines prop interfaces and behavior contracts for:
- **RepositorySelector**: Repository path input with validation
- **TreemapChart**: Visx treemap visualization
- **LoadingState**: Loading indicator during analysis
- **DateRangeSelector**: Time range preset selector (P2 - deferred)
- **EmptyState**: No data message display

**Used By**: Page component → Individual components

---

## Contract Purpose

Contracts serve as:
1. **Development guides**: Define what to build before writing code
2. **Integration points**: Specify how components communicate
3. **Test specifications**: Each contract includes test scenarios
4. **Documentation**: Single source of truth for interfaces

---

## Using Contracts

### For API Development

1. Read `api-git-analysis.md`
2. Write tests for each scenario (success, errors)
3. Implement API route to satisfy contract
4. Verify all test scenarios pass

### For Component Development

1. Read `components.md`
2. Write tests for component props and behavior
3. Implement component to satisfy contract
4. Verify accessibility and states work as specified

---

## Contract Evolution

When modifying contracts:

1. **Update contract first** (describe new interface)
2. **Update tests** (add test cases for new behavior)
3. **Update implementation** (modify code to match contract)
4. **Update documentation** (add change log entry to contract)

**Change Log Format**:
```markdown
## Changes from Initial Design

**2026-01-31**: Initial contract definition
**2026-02-05**: Added pagination support to API response
```

---

## Validation

All contracts are validated through:

- ✅ TypeScript type checking (compile-time)
- ✅ Jest tests (runtime behavior)
- ✅ Integration tests (end-to-end flow)

**Contract compliance = All tests passing**

---

## Related Documents

- [../data-model.md](../data-model.md) - Entity definitions used in contracts
- [../spec.md](../spec.md) - User stories and requirements driving contracts
- [../quickstart.md](../quickstart.md) - How to use contracts during development
