import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native and binary packages that must stay external to the Next.js
  // server bundle — tree-sitter (native C binding), SCIP protobuf, and
  // the scip-typescript CLI wrapper cannot be bundled by Turbopack.
  serverExternalPackages: [
    'tree-sitter',
    'tree-sitter-typescript',
    '@c4312/scip',
    '@bufbuild/protobuf',
    '@sourcegraph/scip-typescript',
  ],
};

export default nextConfig;
