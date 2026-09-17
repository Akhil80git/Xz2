export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  html_url: string;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  size: number;
}

export interface RepoTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  sha?: string;
  children?: FileTreeNode[];
}

export interface VirtualFile {
  path: string;
  name: string;
  content: string;
  isLoaded: boolean;
  isModified: boolean;
  originalContent: string;
  sha?: string;
}

export type ProjectKind = 'html' | 'react-vite' | 'unsupported-backend' | 'unknown';

export interface ProjectAnalysis {
  type: ProjectKind;
  title: string;
  description: string;
  entryPoint?: string;
  isRunnable: boolean;
  dependencies: Record<string, string>;
  warnings: string[];
}

export interface ConsoleLogMessage {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'system';
  message: string;
  timestamp: string;
  details?: string[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface UserSuggestion {
  login: string;
  avatar_url: string;
}

export interface SearchSuggestions {
  query: string;
  users: UserSuggestion[];
  repos: GitHubRepo[];
}
