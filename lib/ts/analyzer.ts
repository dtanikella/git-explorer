import * as ts from 'typescript';
import * as path from 'path';
import {
  TsGraphData,
  TsNode,
  TsEdge,
  FolderNode,
  FileNode,
  FunctionNode,
  ClassNode,
  InterfaceNode,
  ImportNode,
  ImportEdge,
  ExportEdge,
  CallEdge,
  Param,
} from './types';

export function analyzeTypeScriptRepo(repoPath: string, options?: { hideTestFiles?: boolean }): TsGraphData {
  const hideTestFiles = options?.hideTestFiles ?? true;
  const configPath = ts.findConfigFile(repoPath, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    throw new Error('tsconfig.json not found in ' + repoPath);
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  );

  const program = ts.createProgram(parsedConfig.fileNames, {
    ...parsedConfig.options,
    noEmit: true,
  });

  let nodes: TsNode[] = [];
  let edges: TsEdge[] = [];
  const nodeMap = new Map<string, TsNode>();
  const folderMap = new Map<string, FolderNode>();
  const importNodeMap = new Map<string, ImportNode>();
  const fileFunctionMap = new Map<string, Map<string, string>>();
  const callEdgeSet = new Set<string>();

  let edgeIdCounter = 0;
  function nextEdgeId(): string {
    return `edge-${edgeIdCounter++}`;
  }

  // NOTE: The second pass currently only resolves calls within the same file
  // (fnMap is per-file), so 'external' and 'cross-file' are reserved for when
  // the call walker is extended to resolve cross-file and imported call targets.
  function getCallScope(
    sourceFnId: string,
    targetFnId: string
  ): 'same-file' | 'cross-file' | 'external' {
    const targetNode = nodeMap.get(targetFnId);
    if (targetNode?.kind === 'IMPORT' && (targetNode as ImportNode).source === 'package') {
      return 'external';
    }
    const sourceNode = nodeMap.get(sourceFnId);
    if (sourceNode && targetNode && sourceNode.parent === targetNode.parent) {
      return 'same-file';
    }
    return 'cross-file';
  }

  function isLocalImport(specifier: string): boolean {
    return specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/');
  }

  function extractParams(params: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile): Param[] {
    return params.map((p) => ({
      name: ts.isIdentifier(p.name) ? p.name.text : p.name.getText(sourceFile),
      type: p.type ? p.type.getText(sourceFile) : 'any',
    }));
  }

  function ensureFolderChain(dirPath: string): string {
    if (folderMap.has(dirPath)) return folderMap.get(dirPath)!.id;

    const relative = path.relative(repoPath, dirPath);
    const parts = relative.split(path.sep).filter(Boolean);

    if (parts.length === 0) {
      const rootId = 'folder:.';
      const rootNode: FolderNode = {
        id: rootId,
        kind: 'FOLDER',
        parent: null,
        children: [],
        siblings: [],
        name: path.basename(repoPath),
        path: repoPath,
        depth: 0,
      };
      folderMap.set(repoPath, rootNode);
      nodes.push(rootNode);
      nodeMap.set(rootId, rootNode);
      return rootId;
    }

    let currentPath = repoPath;
    for (let i = 0; i < parts.length; i++) {
      const parentPath = currentPath;
      currentPath = path.join(currentPath, parts[i]);
      if (folderMap.has(currentPath)) continue;

      const relCurrent = path.relative(repoPath, currentPath);
      const folderId = `folder:${relCurrent}`;
      const parentFolderId = ensureFolderChain(parentPath);
      const folderNode: FolderNode = {
        id: folderId,
        kind: 'FOLDER',
        parent: parentFolderId,
        children: [],
        siblings: [],
        name: parts[i],
        path: currentPath,
        depth: i + 1,
      };
      folderMap.set(currentPath, folderNode);
      nodes.push(folderNode);
      nodeMap.set(folderId, folderNode);
    }

    const relFinal = path.relative(repoPath, dirPath);
    return `folder:${relFinal}`;
  }

  function ensureFallbackImportNode(specifier: string, parentFolderId: string): string {
    let importNode = importNodeMap.get(specifier);
    if (!importNode) {
      const importId = `import:${specifier}`;
      const isLocal = isLocalImport(specifier);
      importNode = {
        id: importId,
        kind: 'IMPORT',
        parent: isLocal ? parentFolderId : null,
        children: [],
        siblings: [],
        name: specifier,
        source: isLocal ? 'local' : 'package',
      };
      importNodeMap.set(specifier, importNode);
      nodeMap.set(importId, importNode);
    }
    return importNode.id;
  }

  function isTestFile(filePath: string): boolean {
    const parts = filePath.split(path.sep);
    return (
      parts.includes('__tests__') ||
      filePath.includes('.test.ts') ||
      filePath.includes('.test.tsx') ||
      filePath.includes('.spec.ts') ||
      filePath.includes('.spec.tsx')
    );
  }

  const sourceFiles = program.getSourceFiles().filter(
    (sf) => !sf.isDeclarationFile && sf.fileName.startsWith(repoPath)
  );

  // Collect re-exports for deferred edge emission (need all FileNodes in nodeMap first)
  const pendingReexports: Array<{
    sourceFileId: string;
    specifier: string;
    sourceFileName: string;
    parentFolderId: string;
  }> = [];

  // Collect local imports for deferred edge emission (need all FileNodes in nodeMap first)
  const pendingLocalImports: Array<{
    importNodeId: string;
    specifier: string;
    sourceFileName: string;
  }> = [];

  // First pass: emit file/folder nodes and declarations
  for (const sourceFile of sourceFiles) {
    if (hideTestFiles && isTestFile(sourceFile.fileName)) continue;
    const filePath = sourceFile.fileName;
    const relativePath = path.relative(repoPath, filePath);
    const dirPath = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const ext = fileName.endsWith('.tsx') ? 'tsx' : 'ts';

    const parentFolderId = ensureFolderChain(dirPath);

    const isTest = isTestFile(filePath);
    const fileId = `file:${relativePath}`;
    const fileNode: FileNode = {
      id: fileId,
      kind: 'FILE',
      parent: parentFolderId,
      children: [],
      siblings: [],
      name: fileName,
      path: filePath,
      fileType: ext,
      inTestFile: isTest,
    };
    nodes.push(fileNode);
    nodeMap.set(fileId, fileNode);

    const fnMap = new Map<string, string>();
    fileFunctionMap.set(filePath, fnMap);

    ts.forEachChild(sourceFile, (node) => {
      // Import declarations
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
        const isLocal = isLocalImport(specifier);

        let importNode = importNodeMap.get(specifier);
        if (!importNode) {
          const importId = `import:${specifier}`;
          importNode = {
            id: importId,
            kind: 'IMPORT',
            parent: isLocal ? parentFolderId : null,
            children: [],
            siblings: [],
            name: specifier,
            source: isLocal ? 'local' : 'package',
          };
          importNodeMap.set(specifier, importNode);
          nodeMap.set(importId, importNode);
          if (!isLocal) {
            nodes.push(importNode);
          }
        }

        if (!isLocal) {
          const importEdgeKey = `${fileId}→${importNode.id}`;
          if (!callEdgeSet.has(importEdgeKey)) {
            callEdgeSet.add(importEdgeKey);
            edges.push({
              id: nextEdgeId(),
              type: 'import',
              source: fileId,
              target: importNode.id,
            } as ImportEdge);
          }
        }

        if (isLocal) {
          pendingLocalImports.push({
            importNodeId: importNode.id,
            specifier,
            sourceFileName: filePath,
          });
        }
      }

      // Function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const fnName = node.name.text;
        const fnId = `fn:${relativePath}:${fnName}`;
        const isExported = !!(
          ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export
        );
        const fnNode: FunctionNode = {
          id: fnId,
          kind: 'FUNCTION',
          parent: fileId,
          children: [],
          siblings: [],
          name: fnName,
          params: extractParams(node.parameters, sourceFile),
          returnType: node.type ? node.type.getText(sourceFile) : null,
          inTestFile: isTest,
        };
        nodes.push(fnNode);
        nodeMap.set(fnId, fnNode);
        fileNode.children.push(fnId);
        fnMap.set(fnName, fnId);
      }

      // Class declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;
        const classId = `class:${relativePath}:${className}`;
        const isExported = !!(
          ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export
        );

        const extendsClause = node.heritageClauses?.find(
          (h) => h.token === ts.SyntaxKind.ExtendsKeyword
        );
        const implementsClause = node.heritageClauses?.find(
          (h) => h.token === ts.SyntaxKind.ImplementsKeyword
        );

        const decorators: string[] = [];
        if (node.modifiers) {
          for (const mod of node.modifiers) {
            if (ts.isDecorator(mod)) {
              decorators.push(mod.expression.getText(sourceFile));
            }
          }
        }

        let constructorParams: Param[] = [];
        for (const member of node.members) {
          if (ts.isConstructorDeclaration(member)) {
            constructorParams = extractParams(member.parameters, sourceFile);
          }
        }

        const classNode: ClassNode = {
          id: classId,
          kind: 'CLASS',
          parent: fileId,
          children: [],
          siblings: [],
          name: className,
          extends: extendsClause?.types[0]?.expression.getText(sourceFile) ?? null,
          implements: implementsClause?.types.map((t) => t.expression.getText(sourceFile)) ?? [],
          decorators,
          constructorParams,
          inTestFile: isTest,
        };
        nodes.push(classNode);
        nodeMap.set(classId, classNode);
        fileNode.children.push(classId);

        if (isExported) {
          // export edge removed (US1)
        }
      }

      // Interface declarations
      if (ts.isInterfaceDeclaration(node)) {
        const ifaceName = node.name.text;
        const ifaceId = `iface:${relativePath}:${ifaceName}`;
        const isExported = !!(
          ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export
        );

        let propertyCount = 0;
        let methodCount = 0;
        for (const member of node.members) {
          if (ts.isMethodSignature(member)) methodCount++;
          else if (ts.isPropertySignature(member)) propertyCount++;
        }

        const extendsClause = node.heritageClauses?.find(
          (h) => h.token === ts.SyntaxKind.ExtendsKeyword
        );

        const ifaceNode: InterfaceNode = {
          id: ifaceId,
          kind: 'INTERFACE',
          parent: fileId,
          children: [],
          siblings: [],
          name: ifaceName,
          isExported,
          propertyCount,
          methodCount,
          extends: extendsClause?.types.map((t) => t.expression.getText(sourceFile)) ?? [],
          inTestFile: isTest,
        };
        nodes.push(ifaceNode);
        nodeMap.set(ifaceId, ifaceNode);
        fileNode.children.push(ifaceId);

        if (isExported) {
          // export edge removed (US1)
        }
      }

      // Variable declarations: const fn = () => {} or const fn = function() {}
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (
            ts.isIdentifier(decl.name) &&
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
          ) {
            const fnName = decl.name.text;
            const fnId = `fn:${relativePath}:${fnName}`;
            const isExported = !!(
              ts.getCombinedModifierFlags(node as unknown as ts.Declaration) & ts.ModifierFlags.Export
            );
            const fnNode: FunctionNode = {
              id: fnId,
              kind: 'FUNCTION',
              parent: fileId,
              children: [],
              siblings: [],
              name: fnName,
              params: extractParams(decl.initializer.parameters, sourceFile),
              returnType: decl.initializer.type ? decl.initializer.type.getText(sourceFile) : null,
              inTestFile: isTest,
            };
            nodes.push(fnNode);
            nodeMap.set(fnId, fnNode);
            fileNode.children.push(fnId);
            fnMap.set(fnName, fnId);

            if (isExported) {
              // export edge removed (US1)
            }
          }
        }
      }

      // Re-exports: defer edge emission until all FileNodes exist
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
        pendingReexports.push({
          sourceFileId: fileId,
          specifier,
          sourceFileName: filePath,
          parentFolderId,
        });
      }
    });
  }

  // Emit re-export edges now that all FileNodes are in nodeMap
  for (const { sourceFileId, specifier, sourceFileName, parentFolderId } of pendingReexports) {
    const resolvedModule = ts.resolveModuleName(
      specifier,
      sourceFileName,
      program.getCompilerOptions(),
      ts.sys
    );
    const resolvedFile = resolvedModule.resolvedModule?.resolvedFileName;

    let reexportTarget: string;

    if (resolvedFile && resolvedFile.startsWith(repoPath)) {
      const resolvedRelative = path.relative(repoPath, resolvedFile);
      const resolvedFileId = `file:${resolvedRelative}`;
      const targetNode = nodeMap.get(resolvedFileId);
      reexportTarget = targetNode ? resolvedFileId : ensureFallbackImportNode(specifier, parentFolderId);
    } else {
      reexportTarget = ensureFallbackImportNode(specifier, parentFolderId);
    }

    // re-export edge removed (US1)
    void reexportTarget;
  }

  // Resolve local import specifiers (kept for potential future use; no edges emitted)
  const emittedResolutionEdges = new Set<string>();
  for (const { importNodeId, specifier, sourceFileName } of pendingLocalImports) {
    const resolvedModule = ts.resolveModuleName(
      specifier,
      sourceFileName,
      program.getCompilerOptions(),
      ts.sys
    );
    const resolvedFile = resolvedModule.resolvedModule?.resolvedFileName;
    if (resolvedFile && resolvedFile.startsWith(repoPath)) {
      const resolvedRelative = path.relative(repoPath, resolvedFile);
      const resolvedFileId = `file:${resolvedRelative}`;
      const edgeKey = `${importNodeId}→${resolvedFileId}`;
      // import resolution edges removed (US1)
      emittedResolutionEdges.add(edgeKey);
    }
  }

  // Second pass: call edges (intra-file function calls)
  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.fileName;
    const fnMap = fileFunctionMap.get(filePath);
    if (!fnMap || fnMap.size === 0) continue;

    function walkForCalls(node: ts.Node, enclosingFnId: string | null): void {
      // FunctionDeclaration
      if (ts.isFunctionDeclaration(node) && node.name) {
        const fnId = fnMap!.get(node.name.text) ?? null;
        if (node.body) {
          ts.forEachChild(node.body, (child) => walkForCalls(child, fnId));
        }
        return;
      }

      // VariableDeclaration with arrow function or function expression
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        const fnId = fnMap!.get(node.name.text) ?? null;
        const body = node.initializer.body;
        if (body && ts.isBlock(body)) {
          ts.forEachChild(body, (child) => walkForCalls(child, fnId));
        } else if (body) {
          // Concise arrow body: single expression
          walkForCalls(body, fnId);
        }
        return;
      }

      if (ts.isCallExpression(node) && enclosingFnId) {
        const calleeName = node.expression.getText(sourceFile);
        const targetId = fnMap!.get(calleeName);
        if (targetId && targetId !== enclosingFnId) {
          const callKey = `${enclosingFnId}:${targetId}`;
          if (!callEdgeSet.has(callKey)) {
            callEdgeSet.add(callKey);
            edges.push({
              id: nextEdgeId(),
              type: 'call',
              source: enclosingFnId,
              target: targetId,
              callScope: getCallScope(enclosingFnId, targetId),
            } as CallEdge);
          }
        }
      }

      ts.forEachChild(node, (child) => walkForCalls(child, enclosingFnId));
    }

    ts.forEachChild(sourceFile, (node) => walkForCalls(node, null));
  }

  // Third pass: populate parent→children for folder/file hierarchy
  for (const node of nodes) {
    if (node.parent && nodeMap.has(node.parent)) {
      const parentNode = nodeMap.get(node.parent)!;
      if (!parentNode.children.includes(node.id)) {
        parentNode.children.push(node.id);
      }
    }
  }

  // Fourth pass: populate siblings
  const parentGroups = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parent) {
      if (!parentGroups.has(node.parent)) {
        parentGroups.set(node.parent, []);
      }
      parentGroups.get(node.parent)!.push(node.id);
    }
  }
  for (const [, siblingIds] of parentGroups) {
    for (const id of siblingIds) {
      const node = nodeMap.get(id);
      if (node) {
        node.siblings = siblingIds.filter((s) => s !== id);
      }
    }
  }

  // Fifth pass: emit contains edges for FOLDER → child-FOLDER, FOLDER → FILE, and FILE → children
  for (const node of nodes) {
    if (!node.parent) continue;
    const parentNode = nodeMap.get(node.parent);
    if (!parentNode) continue;
    if (parentNode.kind === 'FOLDER' && (node.kind === 'FOLDER' || node.kind === 'FILE')) {
      edges.push({
        id: nextEdgeId(),
        type: 'contains',
        containsScope: 'folder',
        source: node.parent,
        target: node.id,
      });
    } else if (parentNode.kind === 'FILE' && (node.kind === 'FUNCTION' || node.kind === 'CLASS' || node.kind === 'INTERFACE')) {
      edges.push({
        id: nextEdgeId(),
        type: 'contains',
        containsScope: 'file',
        source: node.parent,
        target: node.id,
      });
    }
  }

  // Prune empty folders (folders with no contains-edge children)
  if (hideTestFiles) {
    let changed = true;
    while (changed) {
      changed = false;
      const sourceFolderIds = new Set(edges.filter((e) => e.type === 'contains').map((e) => e.source));
      const emptyFolderIds = nodes
        .filter((n) => n.kind === 'FOLDER' && !sourceFolderIds.has(n.id))
        .map((n) => n.id);
      if (emptyFolderIds.length > 0) {
        const emptySet = new Set(emptyFolderIds);
        nodes = nodes.filter((n) => !emptySet.has(n.id));
        edges = edges.filter((e) => !emptySet.has(e.source) && !emptySet.has(e.target));
        changed = true;
      }
    }
  }

  return { nodes, edges };
}
