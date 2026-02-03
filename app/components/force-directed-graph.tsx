import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface ForceDirectedGraphProps {
  data: {
    nodes: any[];
    links: any[];
  };
}

export default function ForceDirectedGraph({ data }: ForceDirectedGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.parentElement?.clientWidth || 800;
    const height = 600;

    // Clear previous SVG content
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id((d: any) => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-50))
      .force("x", d3.forceX())
      .force("y", d3.forceY());

    // Draw links
    const link = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke-width', (d: any) => Math.sqrt(d.value));

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("pointer-events", "none"); 

    // Draw nodes
    // Custom color logic by filetype
    function getNodeColor(d: any) {
      // Use filename if available, else fallback to id
      const name = d.filename || d.id || '';
      // Test/spec files: match if filename contains test/spec/__tests__ or ends with .test. or .spec.
      if (/test|spec|__tests__|\.test\.|\.spec\./i.test(name)) return '#808080'; // Test files
      if (name.endsWith('.rb')) return '#E0115F'; // Ruby
      if (name.endsWith('.tsx') || name.endsWith('.ts')) return '#1976D2'; // React/TSX
      return '#e0e0e0';
    }
    const node = svg.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', (d: any) => d.radius ? 4 + d.radius : 8)
      .attr('fill', getNodeColor)
      .call(drag(simulation));

    node.append('title').text((d: any) => d.id);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    node
    .on("mouseenter", function(event, d) {
      tooltip
      .style("visibility", "visible")
      .html(`<strong>${d.filename}</strong>`);
    })
    .on("mousemove", function(event) {
        tooltip
        .style("top", (event.pageY - 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseleave", function() {
        tooltip.style("visibility", "hidden");
    });


    function drag(simulation: any) {
      function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    // Zoom
    svg.call(d3.zoom()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        svg.selectAll('g').attr('transform', event.transform);
      })
    );

    return () => {
      simulation.stop();
    };
  }, [data]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={600}
      style={{ display: 'block', width: '100%', height: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc' }}
      aria-label="Disjoint force-directed graph"
    />
  );
}
