// Guards against a recurring failure: tree-sitter's native binding is compiled
// from source (node-gyp), so it's tied to the exact Node ABI active at `npm
// install` time. This repo's dev/build/test scripts force Node 20 at runtime
// (see .nvmrc), so if `npm install` ran under a different Node, the binding
// segfaults the whole process on first use with no JS-catchable error.
//
// This runs as `postinstall`: try loading tree-sitter in a subprocess (so a
// segfault here doesn't take down npm install itself); if it crashes, rebuild
// it for the current Node and verify again before giving up.

const { spawnSync } = require("child_process");

function canLoadTreeSitter() {
  const result = spawnSync(process.execPath, ["-e", "require('tree-sitter')"], {
    stdio: "ignore",
  });
  return result.status === 0;
}

if (canLoadTreeSitter()) {
  process.exit(0);
}

console.warn(
  "[verify-native-bindings] tree-sitter's native binding failed to load under " +
    `Node ${process.version} — rebuilding it for this Node version...`
);

const rebuild = spawnSync("npm", ["rebuild", "tree-sitter", "--build-from-source"], {
  stdio: "inherit",
});

if (rebuild.status !== 0 || !canLoadTreeSitter()) {
  console.error(
    "[verify-native-bindings] tree-sitter still fails to load after rebuilding. " +
      "Make sure you're on Node 20.x (see .nvmrc) and try again with:\n" +
      "  npm rebuild tree-sitter --build-from-source"
  );
  process.exit(1);
}

console.warn("[verify-native-bindings] tree-sitter rebuilt successfully.");
