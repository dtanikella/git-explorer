// Shared types for the diff pipeline.
// Later steps add DiffUnit, MappedSpan, LabelledDeclaration, GitAnalysisNode, etc.

export type DiffStatus = 'added' | 'deleted' | 'modified' | 'unchanged';