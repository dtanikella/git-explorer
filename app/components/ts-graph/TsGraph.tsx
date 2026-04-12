'use client';

import { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { TsGraphData } from '@/lib/ts/types';

interface TsGraphProps {
  repoPath: string;
}

const SYMBOL_KINDS = new Set(['FUNCTION', 'CLASS', 'INTERFACE']);

const NODE_COLORS: Record<string, string> = {
  FUNCTION: '#3b82f6',
  CLASS: '#8b5cf6',
  INTERFACE: '#10b981',
};

const NODE_SIZES: Record<string, number> = {
  FUNCTION: 6,
  CLASS: 10,
  INTERFACE: 8,
};

const EDGE_COLORS: Record<string, string> = {
  call: '#fcd34d',
  uses: '#f9a8d4',
};

const EDGE_SIZES: Record<string, number> = {
  call: 1.5,
  uses: 1,
};

export default function TsGraph({ repoPath }: TsGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [graphData, setGraphData] = useState<TsGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/ts-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles: true }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setGraphData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Network error');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [repoPath]);

  useEffect(() => {
    if (!containerRef.current || !graphData || graphData.nodes.length === 0) return;

    const symbolIds = new Set(
      graphData.nodes.filter((n) => SYMBOL_KINDS.has(n.kind)).map((n) => n.id)
    );

    const graph = new Graph({ type: 'directed' });

    for (const node of graphData.nodes) {
      if (!symbolIds.has(node.id)) continue;
      const name = 'name' in node ? (node as { name: string }).name : node.id;
      graph.addNode(node.id, {
        x: Math.random(),
        y: Math.random(),
        size: NODE_SIZES[node.kind] ?? 6,
        color: NODE_COLORS[node.kind] ?? '#999999',
        label: name,
      });
    }

    for (const edge of graphData.edges) {
      if (!symbolIds.has(edge.source) || !symbolIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      if (graph.hasEdge(edge.source, edge.target) || graph.hasEdge(edge.target, edge.source)) continue;
      graph.addEdge(edge.source, edge.target, {
        size: EDGE_SIZES[edge.type] ?? 1,
        color: EDGE_COLORS[edge.type] ?? '#cccccc',
      });
    }

    if (graph.order === 0) return;

    forceAtlas2.assign(graph, {
      iterations: 200,
      settings: { gravity: 1, scalingRatio: 2, barnesHutOptimize: true },
    });

    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultNodeColor: '#999999',
      defaultEdgeColor: '#cccccc',
    });

    // Inline drag using Sigma's event system
    let draggedNode: string | null = null;

    sigma.on('downNode', ({ node }: { node: string }) => {
      draggedNode = node;
      sigma.getCamera().disable();
    });

    sigma.on('mousemovebody', (e: any) => {
      if (!draggedNode) return;
      const pos = sigma.viewportToGraph(e);
      graph.setNodeAttribute(draggedNode, 'x', pos.x);
      graph.setNodeAttribute(draggedNode, 'y', pos.y);
      e.preventSigmaDefault?.();
    });

    const stopDrag = () => {
      draggedNode = null;
      sigma.getCamera().enable();
    };
    sigma.on('mouseup', stopDrag);
    sigma.on('mouseoutStage', stopDrag);

    sigma.on('enterNode', ({ node }: { node: string }) => {
      const attrs = graph.getNodeAttributes(node);
      const pos = sigma.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
      setTooltip({ label: attrs.label as string, x: pos.x, y: pos.y });
    });

    sigma.on('leaveNode', () => setTooltip(null));

    return () => {
      setTooltip(null);
      sigma.kill();
    };
  }, [graphData]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Analyzing TypeScript structure...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  if (!graphData) return null;

  if (!graphData.nodes.some((n) => SYMBOL_KINDS.has(n.kind))) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        No TypeScript symbols found.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            background: '#1f2937',
            color: '#f9fafb',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
