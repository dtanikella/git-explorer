'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { AnalysisNode } from '@/lib/analysis/types';

interface DistributionChartProps {
  nodes: AnalysisNode[];
  accessor: (node: AnalysisNode) => number;
  label: string;
  xAxisLabel: string;
  colorClass: string;
}

const MARGIN = { top: 16, right: 16, bottom: 72, left: 56 };

interface BinData {
  startSd: number;
  endSd: number;
  count: number;
  files: string[];
}

function computeStats(values: number[]): { mean: number; sd: number } {
  if (values.length === 0) return { mean: 0, sd: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, sd: Math.sqrt(variance) };
}

function buildSdBins(nodes: AnalysisNode[], accessor: (n: AnalysisNode) => number): { bins: BinData[]; mean: number; sd: number } {
  if (nodes.length === 0) return { bins: [], mean: 0, sd: 0 };
  const values = nodes.map(accessor);
  const { mean, sd } = computeStats(values);

  if (sd === 0) {
    return {
      bins: [{ startSd: -0.5, endSd: 0.5, count: nodes.length, files: nodes.map((n) => `${n.filePath}:${n.name}`) }],
      mean,
      sd: 0,
    };
  }

  const zScores = values.map((v) => (v - mean) / sd);
  const minZ = Math.floor(Math.min(...zScores));
  const maxZ = Math.ceil(Math.max(...zScores));
  // Each bin spans 0.5σ
  const binWidth = 0.5;
  const numBins = Math.max(1, Math.ceil((maxZ - minZ) / binWidth));

  const bins: BinData[] = Array.from({ length: numBins }, (_, i) => ({
    startSd: minZ + i * binWidth,
    endSd: minZ + (i + 1) * binWidth,
    count: 0,
    files: [],
  }));

  for (let j = 0; j < nodes.length; j++) {
    const z = zScores[j];
    let idx = Math.floor((z - minZ) / binWidth);
    if (idx >= numBins) idx = numBins - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
    bins[idx].files.push(`${nodes[j].filePath}:${nodes[j].name}`);
  }

  return { bins, mean, sd };
}

function formatSd(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return 'μ';
  return `${rounded > 0 ? '+' : ''}${rounded}σ`;
}

export default function DistributionChart({ nodes, accessor, label, xAxisLabel, colorClass }: DistributionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; bin: BinData; containerWidth: number; containerHeight: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const measure = () => {
      setDimensions({
        width: el.clientWidth || 400,
        height: el.clientHeight || 400,
      });
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { bins, mean, sd } = useMemo(() => buildSdBins(nodes, accessor), [nodes, accessor]);

  const svgWidth = Math.max(dimensions.width - 4, 0);
  const svgHeight = Math.max(dimensions.height - 44, 0);
  const chartWidth = svgWidth - MARGIN.left - MARGIN.right;
  const chartHeight = svgHeight - MARGIN.top - MARGIN.bottom;

  const maxCount = useMemo(() => Math.max(...bins.map((b) => b.count), 1), [bins]);

  // Y-axis: nice round tick values
  const yTicks = useMemo(() => {
    const targetTicks = 6;
    const rawStep = maxCount / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const niceSteps = [1, 2, 5, 10];
    const step = magnitude * (niceSteps.find((s) => s * magnitude >= rawStep) ?? 10);
    const ticks: number[] = [];
    for (let v = 0; v <= maxCount; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < maxCount) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }, [maxCount]);

  // X-axis labels at whole σ values
  const xLabels = useMemo(() => {
    if (bins.length === 0) return [];
    const minSd = bins[0].startSd;
    const maxSd = bins[bins.length - 1].endSd;
    const range = maxSd - minSd;
    const labels: { sd: number; x: number; text: string }[] = [];
    const start = Math.ceil(minSd);
    const end = Math.floor(maxSd);
    // Show labels at every 1σ (or 0.5σ if range is small)
    const step = range <= 4 ? 0.5 : 1;
    for (let s = start; s <= end; s += step) {
      const x = ((s - minSd) / range) * chartWidth;
      labels.push({ sd: s, x, text: formatSd(s) });
    }
    return labels;
  }, [bins, chartWidth]);

  // Mean line position
  const meanLineX = useMemo(() => {
    if (bins.length === 0) return 0;
    const minSd = bins[0].startSd;
    const range = bins[bins.length - 1].endSd - minSd;
    return range > 0 ? ((0 - minSd) / range) * chartWidth : chartWidth / 2;
  }, [bins, chartWidth]);

  if (bins.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        No data
      </div>
    );
  }

  const handleBarHover = (e: React.MouseEvent, bin: BinData) => {
    if (bin.count === 0) return;
    const container = (e.currentTarget as Element).closest('[data-chart-root]') as HTMLElement | null;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    setTooltip({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      bin,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    });
  };

  const handleBarLeave = () => setTooltip(null);

  return (
    <div ref={containerRef} className="w-full overflow-hidden" style={{ position: 'relative', maxHeight: '100%', height: '100%' }} data-chart-root>
      <div className="px-2 pt-2 pb-1">
        <div className="text-sm font-semibold text-gray-700">{label}</div>
        <div className="text-xs text-gray-500">μ = {mean.toFixed(1)}, σ = {sd.toFixed(1)}</div>
      </div>
      <svg
        width={Math.max(dimensions.width - 4, 0)}
        height={Math.max(dimensions.height - 44, 0)}
        style={{ display: 'block', marginLeft: 2 }}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Bars */}
          {bins.map((bin, i) => {
            const barHeight = (bin.count / maxCount) * chartHeight;
            const binSlotWidth = chartWidth / bins.length;
            return (
              <g
                key={i}
                onMouseMove={(e) => handleBarHover(e, bin)}
                onMouseLeave={handleBarLeave}
                style={{ cursor: bin.count > 0 ? 'pointer' : 'default' }}
              >
                <rect
                  x={i * binSlotWidth}
                  y={0}
                  width={binSlotWidth}
                  height={chartHeight}
                  fill="transparent"
                />
                <rect
                  x={i * binSlotWidth + 1}
                  y={chartHeight - barHeight}
                  width={Math.max(binSlotWidth - 2, 1)}
                  height={barHeight}
                  className={colorClass}
                  opacity={0.8}
                  rx={1}
                />
                {bin.count > 0 && barHeight > 14 && (
                  <text
                    x={i * binSlotWidth + binSlotWidth / 2}
                    y={chartHeight - barHeight + 12}
                    fontSize={9}
                    fill="#fff"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {bin.count}
                  </text>
                )}
              </g>
            );
          })}

          {/* Horizontal grid lines */}
          {yTicks.map((tick) => {
            const y = chartHeight - (tick / (yTicks[yTicks.length - 1] || 1)) * chartHeight;
            return (
              <line key={`grid-${tick}`} x1={0} y1={y} x2={chartWidth} y2={y} stroke="#e5e7eb" strokeDasharray="3,3" />
            );
          })}

          {/* Mean line */}
          {meanLineX > 0 && meanLineX < chartWidth && (
            <line x1={meanLineX} y1={0} x2={meanLineX} y2={chartHeight} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,3" />
          )}

          {/* X-axis line */}
          <line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#9ca3af" />

          {/* X-axis σ labels */}
          {xLabels.map(({ sd: s, x, text }) => (
            <g key={s} transform={`translate(${x},${chartHeight})`}>
              <line x1={0} y1={0} x2={0} y2={6} stroke="#9ca3af" />
              <text y={18} fontSize={10} fill={s === 0 ? '#ef4444' : '#4b5563'} textAnchor="middle" fontWeight={s === 0 ? 'bold' : 'normal'}>
                {text}
              </text>
            </g>
          ))}

          {/* X-axis title */}
          <text x={chartWidth / 2} y={chartHeight + 54} fontSize={11} fill="#374151" textAnchor="middle" fontWeight="500">
            {xAxisLabel} (standard deviations)
          </text>

          {/* Y-axis line */}
          <line x1={0} y1={0} x2={0} y2={chartHeight} stroke="#9ca3af" />

          {/* Y-axis ticks and labels */}
          {yTicks.map((tick) => {
            const yMax = yTicks[yTicks.length - 1] || 1;
            const y = chartHeight - (tick / yMax) * chartHeight;
            return (
              <g key={tick}>
                <line x1={-4} y1={y} x2={0} y2={y} stroke="#9ca3af" />
                <text x={-8} y={y + 3} fontSize={10} fill="#4b5563" textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Y-axis title (rotated) */}
          <text
            transform={`translate(-42,${chartHeight / 2}) rotate(-90)`}
            fontSize={11}
            fill="#374151"
            textAnchor="middle"
            fontWeight="500"
          >
            Number of nodes
          </text>
        </g>
      </svg>

        {/* Hover tooltip */}
        {tooltip && (() => {
          const tooltipW = 320;
          const tooltipH = 260;
          const flipX = tooltip.x + tooltipW + 16 > tooltip.containerWidth;
          const flipY = tooltip.y + tooltipH + 16 > tooltip.containerHeight;
          return (
            <div
              style={{
                position: 'absolute',
                left: flipX ? tooltip.x - tooltipW - 8 : tooltip.x + 12,
                top: flipY ? Math.max(tooltip.y - tooltipH, 4) : tooltip.y - 8,
                maxWidth: `${tooltipW}px`,
                maxHeight: `${tooltipH}px`,
                zIndex: 50,
                pointerEvents: 'none',
              }}
              className="bg-gray-900 text-white text-xs rounded-md shadow-lg px-3 py-2 overflow-y-auto"
            >
              <div className="font-semibold mb-1">
                {formatSd(tooltip.bin.startSd)} to {formatSd(tooltip.bin.endSd)} · {tooltip.bin.count} node{tooltip.bin.count !== 1 ? 's' : ''}
              </div>
              <ul className="space-y-0.5">
                {tooltip.bin.files.slice(0, 30).map((f, i) => (
                  <li key={i} className="truncate opacity-90">{f}</li>
                ))}
                {tooltip.bin.files.length > 30 && (
                  <li className="opacity-60">…and {tooltip.bin.files.length - 30} more</li>
                )}
              </ul>
            </div>
          );
        })()}
    </div>
  );
}
