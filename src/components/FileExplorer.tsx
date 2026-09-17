import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  ChevronsUpDown,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  GitBranch,
  ExternalLink,
} from 'lucide-react';
import { FileTreeNode, GitHubRepo, VirtualFile } from '../types';
import { getFileIcon } from './icons';

interface FileExplorerProps {
  tree: FileTreeNode[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  isLoading: boolean;
  repo: GitHubRepo | null;
  virtualFiles: Map<string, VirtualFile>;
  onRefreshTree?: () => void;
}

interface TreeNodeItemProps {
  node: FileTreeNode;
  depth: number;
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  virtualFiles: Map<string, VirtualFile>;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  depth,
  activeFilePath,
  onSelectFile,
  virtualFiles,
  expandedFolders,
  toggleFolder,
}) => {
  const isFolder = node.type === 'folder';
  const isExpanded = expandedFolders.has(node.path);
  const isActive = activeFilePath === node.path;
  const isModified = virtualFiles.get(node.path)?.isModified;
  const isLoaded = virtualFiles.get(node.path)?.isLoaded;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      toggleFolder(node.path);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`group flex items-center justify-between py-1 pr-2.5 text-xs cursor-pointer select-none transition-colors border-l-2 ${
          isActive
            ? 'bg-zinc-800/90 text-white font-medium border-blue-500'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-transparent'
        }`}
        title={node.path}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {isFolder ? (
            <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}

          {getFileIcon(node.name, isFolder, isExpanded)}

          <span className="truncate tracking-tight">{node.name}</span>
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-1.5 pl-2 shrink-0">
          {isModified && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes in memory" />
          )}
          {!isFolder && isLoaded && (
            <span className="text-[10px] text-zinc-600 group-hover:text-zinc-500 font-mono">
              cached
            </span>
          )}
        </div>
      </div>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
              virtualFiles={virtualFiles}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  activeFilePath,
  onSelectFile,
  isLoading,
  repo,
  virtualFiles,
  onRefreshTree,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['src', 'public', 'components'])
  );

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const collect = (nodes: FileTreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          all.add(n.path);
          if (n.children) collect(n.children);
        }
      }
    };
    collect(tree);
    setExpandedFolders(all);
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  // Filter tree by search query
  const filteredTree = useMemo(() => {
    if (!filterQuery.trim()) return tree;

    const query = filterQuery.toLowerCase().trim();

    function filterNodes(nodes: FileTreeNode[]): FileTreeNode[] {
      const res: FileTreeNode[] = [];
      for (const node of nodes) {
        if (node.type === 'file') {
          if (node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)) {
            res.push(node);
          }
        } else if (node.type === 'folder' && node.children) {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length > 0 || node.name.toLowerCase().includes(query)) {
            res.push({
              ...node,
              children: filteredChildren,
            });
          }
        }
      }
      return res;
    }

    return filterNodes(tree);
  }, [tree, filterQuery]);

  return (
    <div className="flex flex-col h-full bg-zinc-900/95 border-r border-zinc-800 select-none text-zinc-300">
      {/* Sidebar Header */}
      <div className="p-2.5 border-b border-zinc-800/80 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 truncate">
            Explorer
          </span>
          {repo && (
            <span className="text-[11px] text-zinc-500 truncate">
              ({repo.default_branch})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded text-[10px] cursor-pointer"
            title="Expand All Folders"
          >
            Expand
          </button>
          <span className="text-zinc-700">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded text-[10px] cursor-pointer"
            title="Collapse All Folders"
          >
            Collapse
          </button>
          {onRefreshTree && (
            <button
              type="button"
              onClick={onRefreshTree}
              className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
              title="Refresh File Tree"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Repo title card */}
      {repo && (
        <div className="px-3 py-2 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="truncate">
            <div className="text-xs font-medium text-zinc-200 truncate" title={repo.full_name}>
              {repo.name}
            </div>
            <div className="text-[10px] text-zinc-500 truncate">
              {repo.owner.login}
            </div>
          </div>
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
            title="Open on GitHub"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Search files */}
      <div className="p-2 border-b border-zinc-800/60">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded px-2 py-1 pl-7 text-xs text-zinc-200 placeholder-zinc-500 outline-none"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto py-1 font-mono text-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-6 text-zinc-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-xs">Fetching repository tree...</span>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-xs">
            {filterQuery ? 'No matching files found' : 'No files in repository'}
          </div>
        ) : (
          <div>
            {filteredTree.map((node) => (
              <TreeNodeItem
                key={node.path}
                node={node}
                depth={0}
                activeFilePath={activeFilePath}
                onSelectFile={onSelectFile}
                virtualFiles={virtualFiles}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {repo && (
        <div className="p-2 bg-zinc-950/80 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex items-center justify-between">
          <span>{tree.length} items</span>
          <span>{virtualFiles.size} in memory</span>
        </div>
      )}
    </div>
  );
};
