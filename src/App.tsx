import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchUserRepos,
  fetchSmartGitHub,
  fetchRepoTree,
  fetchFileContent,
  buildFileTree,
  analyzeProject,
  GitHubApiError,
} from './services/github';
import {
  compileHtmlProject,
  compileReactViteProject,
  CompilationResult,
} from './services/compiler';
import {
  SAMPLE_REPOS,
  SAMPLE_REACT_FILES,
  SAMPLE_HTML_FILES,
  getSampleTreeItems,
} from './services/sampleProjects';
import {
  GitHubRepo,
  RepoTreeItem,
  FileTreeNode,
  VirtualFile,
  ProjectAnalysis,
  ConsoleLogMessage,
  RateLimitInfo,
  SearchSuggestions,
} from './types';
import { Header } from './components/Header';
import { FileExplorer } from './components/FileExplorer';
import { CodeEditor } from './components/CodeEditor';
import { PreviewPanel } from './components/PreviewPanel';
import { ConsolePanel } from './components/ConsolePanel';
import { SettingsModal } from './components/SettingsModal';
import { UnsupportedModal } from './components/UnsupportedModal';
import { AlertTriangle, RefreshCw, X, ShieldCheck, Search, ExternalLink } from 'lucide-react';

export default function App() {
  // Top level state
  const [username, setUsername] = useState('vitejs');
  const [githubToken, setGithubToken] = useState<string>(() => {
    return sessionStorage.getItem('gitrunner_token') || '';
  });
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  // Repositories (Strictly maximum 2 repositories displayed)
  const [repos, setRepos] = useState<GitHubRepo[]>(SAMPLE_REPOS);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(SAMPLE_REPOS[0]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(null);

  // File tree & Virtual Filesystem
  const [treeItems, setTreeItems] = useState<RepoTreeItem[]>([]);
  const [treeNodes, setTreeNodes] = useState<FileTreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [virtualFiles, setVirtualFiles] = useState<Map<string, VirtualFile>>(new Map());

  // Editor Tabs
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Analysis & Build
  const [projectAnalysis, setProjectAnalysis] = useState<ProjectAnalysis | null>(null);
  const [compilation, setCompilation] = useState<CompilationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Panels & UI
  const [showPreview, setShowPreview] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogMessage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUnsupportedModalOpen, setIsUnsupportedModalOpen] = useState(false);

  // Layout sizing
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [consoleHeight, setConsoleHeight] = useState(180);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingConsole, setIsResizingConsole] = useState(false);

  // Log Helper
  const addLog = useCallback(
    (
      type: 'log' | 'info' | 'warn' | 'error' | 'system',
      message: string,
      details?: string[]
    ) => {
      const now = new Date().toLocaleTimeString();
      const newLog: ConsoleLogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type,
        message,
        timestamp: now,
        details,
      };
      setConsoleLogs((prev) => [...prev.slice(-150), newLog]);
    },
    []
  );

  // Listen to sandbox iframe postMessages for console output
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: verify message source
      if (event.data && event.data.source === 'github-runner-sandbox') {
        const { level, message, details } = event.data;
        const logType =
          level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        addLog(logType, message || 'Log', details);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addLog]);

  // Load sample repo on initial mount
  useEffect(() => {
    loadSampleRepo(SAMPLE_REPOS[0]);
  }, []);

  const loadSampleRepo = (sample: GitHubRepo) => {
    setSelectedRepo(sample);
    setRepoError(null);
    const filesDict =
      sample.id === 101 ? SAMPLE_REACT_FILES : SAMPLE_HTML_FILES;
    const items = getSampleTreeItems(filesDict);
    setTreeItems(items);
    setTreeNodes(buildFileTree(items));

    const vf = new Map<string, VirtualFile>();
    for (const [path, content] of Object.entries(filesDict)) {
      vf.set(path, {
        path,
        name: path.split('/').pop() || path,
        content,
        isLoaded: true,
        isModified: false,
        originalContent: content,
      });
    }
    setVirtualFiles(vf);

    const defaultOpen =
      sample.id === 101 ? 'src/App.tsx' : 'index.html';
    setOpenFiles([defaultOpen]);
    setActiveFilePath(defaultOpen);

    const analysis = analyzeProject(items, filesDict['package.json']);
    setProjectAnalysis(analysis);

    addLog('system', `Loaded sample repository: ${sample.name}`);
  };

  // Fetch repositories for a GitHub username, repository, or search query
  const handleFetchRepos = async (overrideInput?: string) => {
    const target = (overrideInput !== undefined ? overrideInput : username).trim();
    if (!target) return;

    setIsLoadingRepos(true);
    setRepoError(null);
    setSuggestions(null);
    addLog('system', `Searching GitHub for "${target}"...`);

    try {
      const result = await fetchSmartGitHub(target, githubToken);
      setRateLimit(result.rateLimit);

      if (result.suggestions) {
        setSuggestions(result.suggestions);
      }

      if (!result.repos || result.repos.length === 0) {
        setRepoError(`No public repositories found for "${target}".`);
        addLog('warn', `No public repositories found for "${target}".`);
        return;
      }

      setRepos(result.repos);

      if (result.sourceType === 'repo') {
        addLog('system', `Loaded repository [${result.repos[0].full_name}] directly.`);
      } else if (result.sourceType === 'search') {
        addLog(
          'system',
          `Found public repositories matching "${target}" via GitHub Search API (showing max 2).`
        );
      } else {
        addLog(
          'system',
          `Retrieved ${result.repos.length} repositories for @${target} (showing max 2).`
        );
      }

      // Select first repository
      await handleSelectRepo(result.repos[0]);
    } catch (err: any) {
      if (err instanceof GitHubApiError) {
        if (err.rateLimit) setRateLimit(err.rateLimit);
        if (err.suggestions) setSuggestions(err.suggestions);
        setRepoError(err.message);
        addLog('error', err.message);
      } else {
        const msg = err.message || 'Failed to fetch repositories.';
        setRepoError(msg);
        addLog('error', msg);
      }
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Select and load repository tree
  const handleSelectRepo = async (repo: GitHubRepo) => {
    // If it's a sample repo
    if (repo.id === 101 || repo.id === 102) {
      loadSampleRepo(repo);
      return;
    }

    setSelectedRepo(repo);
    setIsLoadingTree(true);
    setVirtualFiles(new Map());
    setOpenFiles([]);
    setActiveFilePath(null);
    setCompilation(null);
    addLog('system', `Loading file tree for ${repo.full_name}...`);

    try {
      const { items, rateLimit: rl } = await fetchRepoTree(
        repo.owner.login,
        repo.name,
        repo.default_branch,
        githubToken
      );
      if (rl) setRateLimit(rl);

      setTreeItems(items);
      const tree = buildFileTree(items);
      setTreeNodes(tree);

      // Fetch package.json if it exists to analyze project
      const hasPkg = items.find((f) => f.path.toLowerCase() === 'package.json');
      let pkgContent: string | undefined;

      if (hasPkg) {
        try {
          pkgContent = await fetchFileContent(
            repo.owner.login,
            repo.name,
            hasPkg.path,
            repo.default_branch,
            githubToken
          );
        } catch (e) {
          // ignore
        }
      }

      const analysis = analyzeProject(items, pkgContent);
      setProjectAnalysis(analysis);

      addLog(
        'system',
        `Tree loaded: ${items.length} files. Project type: ${analysis.title}`
      );

      if (analysis.type === 'unsupported-backend') {
        setIsUnsupportedModalOpen(true);
        addLog(
          'warn',
          `Repository detected as backend application: browser runner is disabled.`
        );
      }

      // Auto-open primary file (e.g. index.html or main.tsx or App.tsx or README.md)
      const priorityFiles = [
        'src/App.tsx',
        'src/App.jsx',
        'src/main.tsx',
        'src/main.jsx',
        'src/index.tsx',
        'src/index.jsx',
        'index.html',
        'README.md',
        'package.json',
      ];

      let fileToOpen = items.find((item) =>
        priorityFiles.includes(item.path)
      )?.path;

      if (!fileToOpen && items.length > 0) {
        const firstBlob = items.find((i) => i.type === 'blob');
        if (firstBlob) fileToOpen = firstBlob.path;
      }

      if (fileToOpen) {
        handleOpenFile(fileToOpen, repo);
      }
    } catch (err: any) {
      addLog('error', `Failed to load tree: ${err.message}`);
    } finally {
      setIsLoadingTree(false);
    }
  };

  // Open a file into editor
  const handleOpenFile = async (path: string, repoOverride?: GitHubRepo) => {
    const repo = repoOverride || selectedRepo;
    if (!repo) return;

    // If already open, just switch tab
    if (!openFiles.includes(path)) {
      setOpenFiles((prev) => [...prev, path]);
    }
    setActiveFilePath(path);

    // If file content is already in virtual memory, no need to fetch
    const existing = virtualFiles.get(path);
    if (existing && existing.isLoaded) {
      return;
    }

    // Fetch file content from GitHub
    setIsLoadingFile(true);
    try {
      let content = '';
      if (repo.id === 101) {
        content = SAMPLE_REACT_FILES[path] || '';
      } else if (repo.id === 102) {
        content = SAMPLE_HTML_FILES[path] || '';
      } else {
        content = await fetchFileContent(
          repo.owner.login,
          repo.name,
          path,
          repo.default_branch,
          githubToken
        );
      }

      setVirtualFiles((prev) => {
        const next = new Map<string, VirtualFile>(prev);
        next.set(path, {
          path,
          name: path.split('/').pop() || path,
          content,
          isLoaded: true,
          isModified: false,
          originalContent: content,
        });
        return next;
      });
    } catch (err: any) {
      addLog('error', `Could not load ${path}: ${err.message}`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Close tab
  const handleCloseTab = (path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((p) => p !== path);
      if (activeFilePath === path) {
        const newActive = next.length > 0 ? next[next.length - 1] : null;
        setActiveFilePath(newActive);
      }
      return next;
    });
  };

  // Edit file content in Monaco
  const handleChangeFileContent = (path: string, newContent: string) => {
    setVirtualFiles((prev) => {
      const file = prev.get(path);
      if (!file) return prev;
      const next = new Map<string, VirtualFile>(prev);
      next.set(path, {
        ...file,
        content: newContent,
        isModified: newContent !== file.originalContent,
      });
      return next;
    });
  };

  // Revert file to original version
  const handleRevertFile = (path: string) => {
    setVirtualFiles((prev) => {
      const file = prev.get(path);
      if (!file) return prev;
      const next = new Map<string, VirtualFile>(prev);
      next.set(path, {
        ...file,
        content: file.originalContent,
        isModified: false,
      });
      return next;
    });
    addLog('info', `Reverted ${path} to original GitHub version.`);
  };

  // Helper: ensure all needed project source files are fetched into virtual memory
  const ensureFilesLoaded = async (filePaths: string[]): Promise<Map<string, VirtualFile>> => {
    const currentVF = new Map<string, VirtualFile>(virtualFiles);
    if (!selectedRepo) return currentVF;

    const toFetch = filePaths.filter((p) => {
      const vf = currentVF.get(p);
      return !vf || !vf.isLoaded;
    });

    if (toFetch.length > 0) {
      addLog('system', `Prefetching ${toFetch.length} project dependencies/files...`);
      for (const path of toFetch) {
        try {
          let content = '';
          if (selectedRepo.id === 101) {
            content = SAMPLE_REACT_FILES[path] || '';
          } else if (selectedRepo.id === 102) {
            content = SAMPLE_HTML_FILES[path] || '';
          } else {
            content = await fetchFileContent(
              selectedRepo.owner.login,
              selectedRepo.name,
              path,
              selectedRepo.default_branch,
              githubToken
            );
          }

          currentVF.set(path, {
            path,
            name: path.split('/').pop() || path,
            content,
            isLoaded: true,
            isModified: false,
            originalContent: content,
          });
        } catch (e) {
          // ignore optional files
        }
      }
      setVirtualFiles(currentVF);
    }

    return currentVF;
  };

  // Run Project
  const handleRun = async () => {
    if (!selectedRepo) return;

    if (projectAnalysis?.type === 'unsupported-backend') {
      setIsUnsupportedModalOpen(true);
      return;
    }

    setIsRunning(true);
    setShowPreview(true);
    addLog('system', `Initiating in-browser compilation for [${selectedRepo.name}]...`);

    const startTime = performance.now();

    try {
      // Collect all blob files in project tree that might be relevant
      const sourceExtensions = ['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json'];
      const relevantFiles = treeItems
        .filter(
          (t) =>
            t.type === 'blob' &&
            sourceExtensions.some((ext) => t.path.toLowerCase().endsWith(ext)) &&
            !t.path.includes('node_modules/') &&
            !t.path.includes('.git/')
        )
        .map((t) => t.path);

      // Fetch any un-fetched relevant source files (limit to first 30 files to avoid rate-limits on huge repos)
      const filesToPreload = relevantFiles.slice(0, 30);
      const readyFiles = await ensureFilesLoaded(filesToPreload);

      let result: CompilationResult;

      if (projectAnalysis?.type === 'react-vite') {
        result = await compileReactViteProject(
          readyFiles,
          projectAnalysis.entryPoint || 'src/main.tsx',
          projectAnalysis.dependencies
        );
      } else {
        result = await compileHtmlProject(
          readyFiles,
          projectAnalysis?.entryPoint || 'index.html'
        );
      }

      setCompilation(result);

      for (const log of result.logs) {
        addLog('system', log);
      }

      const elapsed = Math.round(performance.now() - startTime);

      if (result.success) {
        addLog('system', `Build succeeded in ${elapsed}ms! Rendered into sandboxed runner.`);
      } else {
        addLog('error', `Build failed: ${result.error}`);
      }
    } catch (err: any) {
      const errorResult: CompilationResult = {
        success: false,
        html: '',
        error: err.message || 'Unexpected compilation error',
        logs: [`Error: ${err.message}`],
      };
      setCompilation(errorResult);
      addLog('error', `Build error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Save Token
  const handleSaveToken = (token: string) => {
    setGithubToken(token);
    if (token) {
      sessionStorage.setItem('gitrunner_token', token);
      addLog('info', 'GitHub Personal Access Token updated.');
    } else {
      sessionStorage.removeItem('gitrunner_token');
      addLog('info', 'GitHub token removed.');
    }
  };

  // Quick Demo User Selection
  const handleSelectDemoUser = (demoUser: string) => {
    setUsername(demoUser);
    handleFetchRepos(demoUser);
  };

  // Resizing Handlers
  const handleSidebarMouseDown = () => {
    setIsResizingSidebar(true);
  };

  const handleConsoleMouseDown = () => {
    setIsResizingConsole(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(180, Math.min(e.clientX, 500));
        setSidebarWidth(newWidth);
      }
      if (isResizingConsole) {
        const newHeight = Math.max(100, Math.min(window.innerHeight - e.clientY, 500));
        setConsoleHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingConsole(false);
    };

    if (isResizingSidebar || isResizingConsole) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingConsole]);

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <Header
        username={username}
        onUsernameChange={setUsername}
        onSearch={() => handleFetchRepos()}
        isLoadingRepos={isLoadingRepos}
        repos={repos}
        selectedRepo={selectedRepo}
        onSelectRepo={handleSelectRepo}
        projectAnalysis={projectAnalysis}
        onRun={handleRun}
        isRunning={isRunning}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((p) => !p)}
        showConsole={showConsole}
        onToggleConsole={() => setShowConsole((c) => !c)}
        rateLimit={rateLimit}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectDemoUser={handleSelectDemoUser}
      />

      {/* Error & Suggestions Banner */}
      {(repoError || (suggestions && (suggestions.users.length > 0 || suggestions.repos.length > 0))) && (
        <div className="bg-zinc-900 border-b border-zinc-800 text-xs px-4 py-2.5 shrink-0 flex flex-col gap-1.5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-zinc-200">{repoError || `Search suggestions for "${suggestions?.query}":`}</span>
              {rateLimit && rateLimit.remaining === 0 && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="ml-2 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium cursor-pointer transition-colors"
                >
                  Add Free Token (5,000 req/hr)
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setRepoError(null);
                setSuggestions(null);
              }}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Suggestion Chips */}
          {suggestions && (suggestions.users.length > 0 || suggestions.repos.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/60 text-[11px]">
              {suggestions.users.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-zinc-500">Matching Users:</span>
                  {suggestions.users.map((u) => (
                    <button
                      key={u.login}
                      onClick={() => {
                        setUsername(u.login);
                        handleFetchRepos(u.login);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-blue-400 hover:text-blue-300 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      <img
                        src={u.avatar_url}
                        alt={u.login}
                        className="w-3 h-3 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                      <span>@{u.login}</span>
                    </button>
                  ))}
                </div>
              )}

              {suggestions.repos.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 ml-2">
                  <span className="text-zinc-500">Public Repos:</span>
                  {suggestions.repos.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setUsername(r.full_name);
                        handleFetchRepos(r.full_name);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      <span>{r.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: File Explorer */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="h-full shrink-0 flex flex-col relative overflow-hidden"
        >
          <FileExplorer
            tree={treeNodes}
            activeFilePath={activeFilePath}
            onSelectFile={handleOpenFile}
            isLoading={isLoadingTree}
            repo={selectedRepo}
            virtualFiles={virtualFiles}
            onRefreshTree={() => selectedRepo && handleSelectRepo(selectedRepo)}
          />
        </div>

        {/* Draggable Divider for Sidebar */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className="w-1 bg-zinc-800 hover:bg-blue-500 transition-colors cursor-col-resize shrink-0 select-none z-10"
        />

        {/* Center & Right Split: Monaco Editor + Preview Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Main Horizontal Area */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Center: Monaco Code Editor */}
            <div className={`h-full min-w-0 flex-1 overflow-hidden ${showPreview ? 'border-r border-zinc-800' : ''}`}>
              <CodeEditor
                openFiles={openFiles}
                activeFilePath={activeFilePath}
                virtualFiles={virtualFiles}
                onSelectTab={setActiveFilePath}
                onCloseTab={handleCloseTab}
                onChangeContent={handleChangeFileContent}
                onRevertFile={handleRevertFile}
                isLoadingFile={isLoadingFile}
                onRun={handleRun}
              />
            </div>

            {/* Right: Live Preview Panel (if enabled) */}
            {showPreview && (
              <div className="w-1/2 min-w-[320px] h-full overflow-hidden flex flex-col">
                <PreviewPanel
                  compilation={compilation}
                  isRunning={isRunning}
                  onRun={handleRun}
                  projectAnalysis={projectAnalysis}
                  onClose={() => setShowPreview(false)}
                />
              </div>
            )}
          </div>

          {/* Draggable Divider for Console */}
          {showConsole && (
            <div
              onMouseDown={handleConsoleMouseDown}
              className="h-1 bg-zinc-800 hover:bg-amber-500 transition-colors cursor-row-resize shrink-0 select-none z-10"
            />
          )}

          {/* Bottom: Console Panel */}
          {showConsole && (
            <div
              style={{ height: `${consoleHeight}px` }}
              className="w-full shrink-0 overflow-hidden"
            >
              <ConsolePanel
                logs={consoleLogs}
                onClearLogs={() => setConsoleLogs([])}
                onClose={() => setShowConsole(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        token={githubToken}
        onSaveToken={handleSaveToken}
        rateLimit={rateLimit}
      />

      <UnsupportedModal
        isOpen={isUnsupportedModalOpen}
        onClose={() => setIsUnsupportedModalOpen(false)}
        analysis={projectAnalysis}
      />
    </div>
  );
}
