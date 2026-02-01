import { FileNode } from '../../lib/types';

interface TooltipProps {
  node: FileNode;
  rootPath: string;
}

export function Tooltip({ node, rootPath }: TooltipProps) {
  const formatSize = (size: number) => {
    if (size < 1024) return `${size} bytes`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Compute relative path from root
  const relativePath = node.path.startsWith(rootPath) 
    ? node.path.slice(rootPath.length).replace(/^\//, '') || node.name
    : node.path;

  return (
    <div className="bg-black text-white p-2 rounded shadow-lg">
      <div className="font-semibold">{node.name}</div>
      <div className="text-sm text-gray-300">{relativePath}</div>
      <div className="text-sm">
        {node.type === 'file' ? (
          <>
            {formatSize(node.size)} • {node.extension}
          </>
        ) : (
          <>
            {formatSize(node.size)} • {node.children?.length || 0} children
          </>
        )}
      </div>
    </div>
  );
}