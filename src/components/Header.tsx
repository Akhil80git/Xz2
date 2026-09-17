import React, { useState } from 'react';
import {
  Search,
  Play,
  Layers,
  Terminal,
  Key,
  Github,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Star,
  GitFork,
  Loader2,
  RefreshCw,
  Code2,
} from 'lucide-react';
import { GitHubRepo, ProjectAnalysis, RateLimitInfo } from '../types';

interface HeaderProps {
  username: string;
  onUsernameChange: (u: string) => void;
  onSearch: (e?: React.FormEvent) => void;
  isLoadingRepos: boolean;
  repos: GitHubRepo[];
  selectedRepo: GitHubRepo | null;
  onSelectRepo: (repo: GitHubRepo) => void;
  projectAnalysis: ProjectAnalysis | null;
  onRun: () => void;
  isRunning: boolean;
  showPreview: boolean;
  onTogglePreview: () => void;
  showConsole: boolean;
  onToggleConsole: () => void;
  rateLimit: RateLimitInfo | null;
  onOpenSettings: () => void;
  onSelectDemoUser: (user: string) => void;
}

const DEMO_USERS = ['vitejs', 'facebook', 'octocat', 'mrdoob'];

export const Header: React.FC<HeaderProps> = ({
  username,
  onUsernameChange,
  onSearch,
  isLoadingRepos,
  repos,
  selectedRepo,
  onSelectRepo,
  projectAnalysis,
  onRun,
  isRunning,
  showPreview,
  onTogglePreview,
  showConsole,
  onToggleConsole,
  rateLimit,
  onOpenSettings,
  onSelectDemoUser,
}) => {
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoadingRepos && username.trim()) {
      onSearch(e);
    }
  };

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 text-zinc-200 select-none">
      {/* Primary Top Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 gap-3 min-h-[52px]">
        {/* Left: Brand + GitHub Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <Code2 className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <span className="font-semibold text-xs text-white tracking-wide block leading-tight">
                GitRunner
              </span>
              <span className="text-[10px] text-zinc-400 block leading-tight">
                In-Browser IDE
              </span>
            </div>
          </div>

          {/* GitHub Username / Repo / URL Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <div className="absolute left-2.5 text-zinc-500 pointer-events-none">
                <Github className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="GitHub username, owner/repo, or URL..."
                className="w-48 sm:w-64 md:w-72 bg-zinc-950 border border-zinc-700 hover:border-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 pl-8 text-xs text-zinc-100 placeholder-zinc-500 outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isLoadingRepos || !username.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoadingRepos ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Search</span>
            </button>
          </form>

          {/* Quick Demo suggestions */}
          <div className="hidden xl:flex items-center gap-1 text-[11px] text-zinc-400 pl-1">
            <span className="text-zinc-500">Popular:</span>
            {DEMO_USERS.map((demo) => (
              <button
                key={demo}
                type="button"
                onClick={() => onSelectDemoUser(demo)}
                className="px-1.5 py-0.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                @{demo}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Repository Selector (max 2 repositories as per prompt) */}
        {repos.length > 0 && (
          <div className="flex items-center gap-1.5 bg-zinc-950/80 p-1 rounded border border-zinc-800">
            <span className="text-[11px] text-zinc-500 px-1.5 font-medium hidden md:inline">
              Repos (Max 2):
            </span>
            {repos.map((repo) => {
              const isSelected = selectedRepo?.id === repo.id;
              return (
                <button
                  key={repo.id}
                  onClick={() => onSelectRepo(repo)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                  }`}
                  title={`${repo.full_name}${repo.description ? ` - ${repo.description}` : ''}`}
                >
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">
                    {repo.name}
                  </span>
                  {repo.stargazers_count > 0 && (
                    <span className="flex items-center text-[10px] text-amber-400 gap-0.5 opacity-80">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      {repo.stargazers_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Project Badge + Run Button + Panel Toggles */}
        <div className="flex items-center gap-2">
          {/* Project Type Badge */}
          {projectAnalysis && (
            <div className="hidden xl:flex items-center">
              {projectAnalysis.type === 'react-vite' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/70 border border-emerald-800/80 rounded text-[11px] text-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>React + Vite (Runnable)</span>
                </div>
              )}
              {projectAnalysis.type === 'html' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-950/70 border border-blue-800/80 rounded text-[11px] text-blue-300">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span>HTML / JS (Runnable)</span>
                </div>
              )}
              {projectAnalysis.type === 'unsupported-backend' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-950/70 border border-amber-800/80 rounded text-[11px] text-amber-300" title={projectAnalysis.description}>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Backend (Code View Only)</span>
                </div>
              )}
              {projectAnalysis.type === 'unknown' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-zinc-400">
                  <span>Static Code</span>
                </div>
              )}
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={onRun}
            disabled={!selectedRepo || isRunning || projectAnalysis?.type === 'unsupported-backend'}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              isRunning
                ? 'bg-emerald-600 text-white animate-pulse cursor-wait'
                : projectAnalysis?.type === 'unsupported-backend'
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
            }`}
            title={
              projectAnalysis?.type === 'unsupported-backend'
                ? 'Backend projects cannot be run directly in the browser'
                : 'Compile & run project in sandboxed runner (Ctrl+Enter)'
            }
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? 'Building...' : 'Run'}</span>
          </button>

          {/* Toggle Preview */}
          <button
            type="button"
            onClick={onTogglePreview}
            className={`p-1.5 rounded border transition-colors cursor-pointer text-xs flex items-center gap-1 ${
              showPreview
                ? 'bg-zinc-800 text-blue-400 border-zinc-700'
                : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:bg-zinc-900'
            }`}
            title="Toggle Live Preview Panel"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Toggle Console */}
          <button
            type="button"
            onClick={onToggleConsole}
            className={`p-1.5 rounded border transition-colors cursor-pointer text-xs flex items-center gap-1 ${
              showConsole
                ? 'bg-zinc-800 text-amber-400 border-zinc-700'
                : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:bg-zinc-900'
            }`}
            title="Toggle Terminal Console"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Console</span>
          </button>

          {/* Rate Limit & Settings */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded border bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
            title={
              rateLimit
                ? `GitHub API: ${rateLimit.remaining}/${rateLimit.limit} requests remaining. Click to configure Personal Access Token.`
                : 'GitHub API Settings & Rate Limits'
            }
          >
            <Key className="w-3.5 h-3.5" />
            {rateLimit && (
              <span className="text-[10px] hidden md:inline text-zinc-500 font-mono">
                {rateLimit.remaining} left
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
