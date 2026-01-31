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

export const CircleNode: React.FC<CircleNodeProps> = ({
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
    />
  );
};