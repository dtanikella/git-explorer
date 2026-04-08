import { NodeForceRule, EdgeForceRule, CallEdge } from './types';

export const defaultNodeRules: NodeForceRule[] = [
  {
    id: 'folder-nodes',
    label: 'Folders',
    enabled: true,
    match: (n) => n.kind === 'FOLDER',
    forces: { charge: -400, collideRadius: 30, zone: 'center' },
    style: { color: '#d1d5db', radius: 12 },
  },
  {
    id: 'file-tsx',
    label: 'TSX Files',
    enabled: true,
    match: (n) => n.kind === 'FILE' && n.fileType === 'tsx',
    forces: { charge: -200, collideRadius: 15 },
    style: { color: '#9ca3af', radius: 8 },
  },
  {
    id: 'file-ts',
    label: 'TS Files',
    enabled: true,
    match: (n) => n.kind === 'FILE' && n.fileType === 'ts',
    forces: { charge: -200, collideRadius: 15 },
    style: { color: '#9ca3af', radius: 8 },
  },
  {
    id: 'function-nodes',
    label: 'Functions',
    enabled: true,
    match: (n) => n.kind === 'FUNCTION',
    forces: { charge: -100, collideRadius: 8 },
    style: { color: '#10b981', radius: 5 },
  },
  {
    id: 'class-nodes',
    label: 'Classes',
    enabled: true,
    match: (n) => n.kind === 'CLASS',
    forces: { charge: -300, collideRadius: 20 },
    style: { color: '#f59e0b', radius: 10 },
  },
  {
    id: 'interface-nodes',
    label: 'Interfaces',
    enabled: true,
    match: (n) => n.kind === 'INTERFACE',
    forces: { charge: -150, collideRadius: 12 },
    style: { color: '#8b5cf6', radius: 7 },
  },
];

export const defaultEdgeRules: EdgeForceRule[] = [
  {
    id: 'contains-edges',
    label: 'Contains Edges',
    enabled: true,
    match: (e) => e.type === 'contains',
    forces: { linkDistance: 100, linkStrength: 0.6 },
    style: { color: '#e5e7eb', width: 0.5 },
  },
  {
    id: 'call-same-file',
    label: 'Same-File Calls',
    enabled: true,
    match: (e) => e.type === 'call' && (e as CallEdge).callScope === 'same-file',
    forces: { linkDistance: 30, linkStrength: 1.0 },
    style: { color: '#374151', width: 1 },
  },
  {
    id: 'call-cross-file',
    label: 'Cross-File Calls',
    enabled: true,
    match: (e) => e.type === 'call' && (e as CallEdge).callScope === 'cross-file',
    forces: { linkDistance: 60, linkStrength: 0.6 },
    style: { color: '#111827', width: 1 },
  },
  {
    id: 'call-external',
    label: 'External Calls',
    enabled: true,
    match: (e) => e.type === 'call' && (e as CallEdge).callScope === 'external',
    forces: { linkDistance: 100, linkStrength: 0.3 },
    style: { color: '#3b82f6', width: 1 },
  },
];
