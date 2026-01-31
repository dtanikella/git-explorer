import { FileNode, ColoringStrategy } from '../types';

/**
 * Maps file extensions to colors based on file type categories
 */
export const extensionColorStrategy: ColoringStrategy = (node: FileNode): string => {
  if (node.type === 'folder') {
    return '#8b8b8b'; // Gray for folders
  }

  const extension = node.extension.toLowerCase().replace('.', '');

  switch (extension) {
    // Programming Languages
    case 'js':
    case 'jsx':
      return '#f7df1e'; // JavaScript yellow
    case 'ts':
    case 'tsx':
      return '#3178c6'; // TypeScript blue
    case 'py':
      return '#3572a5'; // Python blue
    case 'java':
      return '#ED8B00'; // Java orange
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c++':
    case 'hpp':
    case 'hxx':
    case 'h++':
      return '#00599C'; // C++ blue
    case 'c':
    case 'h':
      return '#A8B9CC'; // C light blue
    case 'cs':
      return '#239120'; // C# green
    case 'php':
      return '#777BB4'; // PHP purple
    case 'rb':
      return '#cc342d'; // Ruby red
    case 'go':
      return '#00add8'; // Go cyan
    case 'rs':
      return '#dea584'; // Rust tan
    case 'swift':
      return '#FA7343'; // Swift orange
    case 'kt':
    case 'kts':
      return '#7F52FF'; // Kotlin purple
    case 'scala':
      return '#DC322F'; // Scala red
    case 'clj':
    case 'cljs':
      return '#5881D8'; // Clojure blue
    case 'hs':
      return '#5D4F85'; // Haskell purple
    case 'ml':
      return '#DC143C'; // OCaml crimson
    case 'fs':
    case 'fsx':
      return '#378BBA'; // F# blue
    case 'elm':
      return '#60B5CC'; // Elm cyan
    case 'dart':
      return '#00B4AB'; // Dart teal
    case 'lua':
      return '#000080'; // Lua navy
    case 'r':
      return '#276DC3'; // R blue
    case 'jl':
      return '#9558B2'; // Julia purple
    case 'ex':
    case 'exs':
      return '#6E4A7E'; // Elixir purple
    case 'cl':
      return '#ED2E2F'; // Common Lisp red
    case 'scm':
      return '#22228B'; // Scheme dark blue
    case 'pl':
    case 'pm':
      return '#0243A6'; // Perl blue
    case 'tcl':
      return '#E4CC98'; // Tcl beige
    case 'vb':
      return '#945DB7'; // VB purple

    // Web Technologies
    case 'html':
    case 'htm':
      return '#e34c26'; // HTML red
    case 'css':
      return '#663399'; // CSS purple
    case 'scss':
    case 'sass':
      return '#663399'; // SCSS/Sass purple (same as CSS)
    case 'less':
      return '#1D365D'; // Less dark blue
    case 'json':
      return '#f5a623'; // JSON orange
    case 'xml':
      return '#FF6600'; // XML orange
    case 'yaml':
    case 'yml':
      return '#cb171e'; // YAML red
    case 'toml':
      return '#9C4221'; // TOML brown
    case 'md':
    case 'markdown':
      return '#00d4aa'; // Markdown teal
    case 'txt':
      return '#4A4A4A'; // Text gray

    // Configuration & Data
    case 'ini':
    case 'cfg':
    case 'conf':
      return '#FFD43B'; // Config yellow
    case 'env':
      return '#ECD53F'; // Env yellow
    case 'sql':
      return '#336791'; // SQL blue
    case 'csv':
      return '#237F52'; // CSV green
    case 'db':
    case 'sqlite':
    case 'sqlite3':
      return '#003B57'; // Database dark teal

    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'tiff':
    case 'svg':
    case 'ico':
    case 'webp':
      return '#FF6B35'; // Image orange

    // Documents
    case 'pdf':
      return '#DC2626'; // PDF red
    case 'doc':
    case 'docx':
      return '#2B579A'; // Word blue
    case 'xls':
    case 'xlsx':
      return '#217346'; // Excel green
    case 'ppt':
    case 'pptx':
      return '#D24726'; // PowerPoint orange

    // Archives
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
    case 'bz2':
    case 'xz':
      return '#8B5A3C'; // Archive brown

    // Other
    case 'log':
      return '#6B7280'; // Log gray
    case 'lock':
      return '#EF4444'; // Lock red
    case 'gitignore':
    case 'dockerignore':
    case 'eslintignore':
    case 'prettierignore':
      return '#6B7280'; // Ignore gray

    default:
      return '#8b8b8b'; // Default gray for unknown extensions
  }
};

/**
 * Maps file types to colors (folder vs file)
 */
export const typeColorStrategy: ColoringStrategy = (node: FileNode): string => {
  return node.type === 'folder' ? '#e0e0e0' : '#3178c6';
};