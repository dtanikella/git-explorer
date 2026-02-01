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
}

// T041: Wrap CircleNode in React.memo
export const CircleNode: React.FC<CircleNodeProps> = React.memo(({
  node,
  fill,
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
      data-node-path={node.data.path} // For event delegation
      data-node-type={node.data.type}
      style={{ cursor: 'pointer' }}
      aria-label={`${node.data.name} (${isFolder ? 'folder' : 'file'})`}
    />
  );
});

CircleNode.displayName = 'CircleNode';