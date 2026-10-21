/** Kind of a synthetic directory hub. */
export type DirectoryHubKind = 'FILE' | 'FOLDER';

/**
 * Kind of a synthetic directory link.
 *
 * @remarks
 * `IN_FILE` runs node → file hub, `IN_FOLDER` file hub → folder hub, and `IN_PARENT` folder hub → its parent folder hub.
 */
export type DirectoryEdgeKind = 'IN_FILE' | 'IN_FOLDER' | 'IN_PARENT';

/** A synthetic file or folder node that anchors the nodes it contains. */
export interface DirectoryHub {
  /** unique across hubs and real node ids */
  id: string;
  kind: DirectoryHubKind;
  /** the file path, or the folder path (`''` is the root folder) */
  path: string;
  /** last path segment; the root folder is `'/'` */
  name: string;
}

/** A synthetic link between a node/hub and the hub that contains it. */
export interface DirectoryLink {
  kind: DirectoryEdgeKind;
  source: string;
  target: string;
}

/** Output of {@link buildDirectoryHubs}. */
export interface DirectoryHubs {
  hubs: DirectoryHub[];
  links: DirectoryLink[];
}

/** Hub id of a file path. */
export const fileHubId = (path: string) => `\u0000file:${path}`;
/** Hub id of a folder path (`''` is the root). */
export const folderHubId = (path: string) => `\u0000dir:${path}`;

function parentFolder(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

/**
 * Every folder that contains a file, nearest first, ending with the root (`''`).
 *
 * @param filePath - The file path.
 * @returns Folder paths from the file's own folder up to the root.
 */
export function ancestorFolders(filePath: string): string[] {
  const out: string[] = [];
  for (let p = parentFolder(filePath); ; p = parentFolder(p)) {
    out.push(p);
    if (p === '') return out;
  }
}

/**
 * Derives the file and folder hubs (and the links holding them together) for a set of nodes.
 *
 * @remarks
 * One hub per distinct file, one per folder on the way up to the root, and a single link per
 * containment: node → file, file → folder, folder → parent folder. Hubs exist only for the
 * files of the given nodes, so a filtered graph gets a filtered directory. Every node of a
 * file shares that file's hub instead of being bonded to each sibling, so the cost is linear
 * in the node count.
 *
 * @param nodes - The nodes present in the simulation, with the file each lives in.
 * @returns The hubs and the containment links.
 */
export function buildDirectoryHubs(nodes: ReadonlyArray<{ id: string; filePath: string }>): DirectoryHubs {
  const hubs: DirectoryHub[] = [];
  const links: DirectoryLink[] = [];
  const files = new Set<string>();
  const folders = new Set<string>();

  const addFolder = (path: string) => {
    for (let p = path; !folders.has(p); p = parentFolder(p)) {
      folders.add(p);
      hubs.push({ id: folderHubId(p), kind: 'FOLDER', path: p, name: p === '' ? '/' : p.slice(p.lastIndexOf('/') + 1) });
      if (p === '') break;
      links.push({ kind: 'IN_PARENT', source: folderHubId(p), target: folderHubId(parentFolder(p)) });
    }
  };

  for (const n of nodes) {
    if (!files.has(n.filePath)) {
      files.add(n.filePath);
      const folder = parentFolder(n.filePath);
      hubs.push({ id: fileHubId(n.filePath), kind: 'FILE', path: n.filePath, name: n.filePath.slice(n.filePath.lastIndexOf('/') + 1) });
      links.push({ kind: 'IN_FOLDER', source: fileHubId(n.filePath), target: folderHubId(folder) });
      addFolder(folder);
    }
    links.push({ kind: 'IN_FILE', source: n.id, target: fileHubId(n.filePath) });
  }
  return { hubs, links };
}
