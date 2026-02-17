import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
// Removed flareData import; packingData will be passed as a prop

export default function CirclePackingGraph({ width, height, packingData }: { width: number; height: number; packingData: any }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Clear previous SVG
    ref.current.innerHTML = '';

    // D3 circle packing logic
    const root = d3.hierarchy(packingData)
      .sum((d: any) => d.value)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const pack = d3.pack()
      .size([width, height])
      .padding(3);

    const packedRoot = pack(root);

    const svg = d3.select(ref.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height].join(' '))
      .style('display', 'block')
      .style('background', '#f9f9f9');

    let focus = packedRoot;
    let view = [packedRoot.x, packedRoot.y, packedRoot.r * 2];

    const color = d3.scaleLinear<string>()
      .domain([0, 5])
      .range(["#d1e6fa", "#00509e"])
      .interpolate(d3.interpolateHcl);

    const node = svg.append('g')
      .selectAll('circle')
      .data(packedRoot.descendants())
      .join('circle')
      .attr('fill', d => d.children ? color(d.depth) : '#fff')
      .attr('pointer-events', d => !d.children ? 'none' : undefined)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#000');
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('stroke', null);
      })
      .on('click', (event, d) => {
        if (focus !== d) zoom(event, d);
        event.stopPropagation();
      })
      .attr('stroke', d => d.parent ? '#ccc' : '#333')
      .attr('stroke-width', 2);

    const label = svg.append('g')
      .style('font', '16px sans-serif')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(packedRoot.descendants())
      .join('text')
      .style('fill-opacity', d => d.parent === packedRoot ? 1 : 0)
      .style('display', d => d.parent === packedRoot ? 'inline' : 'none')
      .text(d => d.data.name);

    svg.on('click', (event) => zoom(event, packedRoot));

    function zoom(event: any, d: any) {
      focus = d;

      const transition = svg.transition()
        .duration(event.altKey ? 7500 : 750)
        .tween('zoom', () => {
          const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
          return t => zoomTo(i(t));
        });

      label
        .filter(function (l) { return l.parent === focus || this.style.display === 'inline'; })
        .transition(transition)
        .style('fill-opacity', l => l.parent === focus ? 1 : 0)
        .on('start', function (l) { if (l.parent === focus) this.style.display = 'inline'; })
        .on('end', function (l) { if (l.parent !== focus) this.style.display = 'none'; });
    }

    function zoomTo(v: [number, number, number]) {
      const k = width / v[2];
      view = v;
      node.attr('transform', d => `translate(${k * d.x + width / 2 - k * v[0]},${k * d.y + height / 2 - k * v[1]})`);
      node.attr('r', d => k * d.r);
      label.attr('transform', d => `translate(${k * d.x + width / 2 - k * v[0]},${k * d.y + height / 2 - k * v[1]})`);
    }

    zoomTo(view);
  }, [width, height, packingData]);

  return <div ref={ref} style={{ width, height }} />;
}
