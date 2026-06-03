'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import type { AnalysisNode } from '@/lib/analysis/types';
import { filterAndSortNodes, normalizeOutboundRefs, getTreemapColor } from './treemap-utils';

interface StatsTreemapProps {
  nodes: AnalysisNode[];
  topN: number;
  hideTestFiles: boolean;
  onNodeSelect: (scipSymbol: string) => void;
}

interface TreemapDatum {
  name: string;
  filePath: string;
  scipSymbol: string;
  value: number;
  outboundCount: number;
  inboundCount: number;
}

export default function StatsTreemap({ nodes, topN, hideTestFiles, onNodeSelect }: StatsTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 600,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const treemapData = useMemo(() => {
    const filtered = filterAndSortNodes(nodes, topN, hideTestFiles);
    return filtered.map((n) => ({
      name: n.name,
      filePath: n.filePath,
      scipSymbol: n.scipSymbol,
      value: n.referencedAt.length,
      outboundCount: n.outboundRefs.length,
      inboundCount: n.referencedAt.length,
    }));
  }, [nodes, topN, hideTestFiles]);

  const layout = useMemo(() => {
    if (treemapData.length === 0) return [];

    const root = hierarchy<{ children: TreemapDatum[] }>({ children: treemapData } as any)
      .sum((d: any) => d.value ?? 0);

    treemap<any>()
      .size([dimensions.width, dimensions.height])
      .padding(2)
      .tile(treemapSquarify)(root);

    return root.leaves() as HierarchyRectangularNode<TreemapDatum>[];
  }, [treemapData, dimensions]);

  const maxOutbound = useMemo(
    () => Math.max(...treemapData.map((d) => d.outboundCount), 1),
    [treemapData],
  );

  if (treemapData.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center text-gray-400">
        No nodes with inbound references found
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full" style={{ position: 'relative' }}>
      <svg width={dimensions.width} height={dimensions.height}>
        {layout.map((leaf) => {
          const d = leaf.data as TreemapDatum;
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const color = getTreemapColor(normalizeOutboundRefs(d.outboundCount, maxOutbound));

          return (
            <g
              key={d.scipSymbol}
              data-symbol={d.scipSymbol}
              onClick={() => onNodeSelect(d.scipSymbol)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={w}
                height={h}
                fill={color}
                stroke="#fff"
                strokeWidth={1}
              />
              {w > 60 && h > 40 && (
                <foreignObject x={leaf.x0 + 4} y={leaf.y0 + 4} width={w - 8} height={h - 8}>
                  <div
                    style={{
                      fontSize: '10px',
                      lineHeight: '1.2',
                      overflow: 'hidden',
                      color: normalizeOutboundRefs(d.outboundCount, maxOutbound) > 0.5 ? '#fff' : '#1f2937',
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{d.name}</div>
                    <div style={{ opacity: 0.8 }}>{d.filePath}</div>
                    <div>↗ {d.inboundCount} ↘ {d.outboundCount}</div>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
