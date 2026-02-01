import React from 'react';

interface CircleNodeProps {
  node: {
    x: number;
    y: number;
    r: number;
    data: {
      path: string;
      name: string;
      type: 'file' | 'folder';
      size: number;
      extension: string;
      metadata: Record<string, unknown>;
    };
  };
  fill: string;
  onMouseEnter?: (event: React.MouseEvent<SVGCircleElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<SVGCircleElement>) => void;
  onClick?: (event: React.MouseEvent<SVGCircleElement>) => void;
}

// T041: Wrap CircleNode in React.memo
export const CircleNode: React.FC<CircleNodeProps> = React.memo(({
  node,
  fill,
  onMouseEnter,
  onMouseLeave,
  onClick,
}) => {
  const isFolder = node.data.type === 'folder';
  
  return (
    <circle
      cx={node.x}
      cy={node.y}
      r={node.r}
      fill={fill}
      fillOpacity={isFolder ? 0.3 : 1}
      stroke="#fff"
      strokeWidth={1}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      aria-label={`${node.data.name} (${isFolder ? 'folder' : 'file'})`}
    />
  );
});

CircleNode.displayName = 'CircleNode';