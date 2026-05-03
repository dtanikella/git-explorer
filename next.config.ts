import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'tree-sitter',
    'tree-sitter-typescript',
    '@c4312/scip',
    '@bufbuild/protobuf',
    '@sourcegraph/scip-typescript',
  ],
};

export default nextConfig;
