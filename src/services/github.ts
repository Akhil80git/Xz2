import {
  GitHubRepo,
  RepoTreeItem,
  FileTreeNode,
  ProjectAnalysis,
  RateLimitInfo,
  UserSuggestion,
  SearchSuggestions,
} from '../types';

export class GitHubApiError extends Error {
  status: number;
  rateLimit?: RateLimitInfo;
  suggestions?: SearchSuggestions;
  constructor(
    message: string,
    status: number,
    rateLimit?: RateLimitInfo,
    suggestions?: SearchSuggestions
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.rateLimit = rateLimit;
    this.suggestions = suggestions;
  }
}

// In-memory cache to conserve the 60 req/hr rate limit
const cache = new Map<string, { data: any; rateLimit: RateLimitInfo; expires: number }>();

function getCached<T>(key: string): { data: T; rateLimit: RateLimitInfo } | null {
  const item = cache.get(key);
  if (item && item.expires > Date.now()) {
    return { data: item.data as T, rateLimit: item.rateLimit };
  }
  return null;
}

function setCache<T>(key: string, data: T, rateLimit: RateLimitInfo, ttlMs = 180000): void {
  cache.set(key, { data, rateLimit, expires: Date.now() + ttlMs });
}

function extractRateLimit(headers: Headers): RateLimitInfo {
  const limit = parseInt(headers.get('x-ratelimit-limit') || '60', 10);
  const remaining = parseInt(headers.get('x-ratelimit-remaining') || '60', 10);
  const reset = parseInt(headers.get('x-ratelimit-reset') || '0', 10);
  return { limit, remaining, reset };
}

/**
 * Intelligently parse user input to handle:
 * - Direct usernames: "facebook", "octocat"
 * - Repositories: "facebook/react", "vitejs/vite"
 * - URLs: "https://github.com/facebook/react" or "https://github.com/facebook"
 * - Emails: "akhilgarg8085@gmail.com" -> "akhilgarg8085"
 * - Search queries: "react counter"
 */
export function parseGitHubInput(input: string): {
  type: 'repo' | 'user' | 'query';
  owner?: string;
  repo?: string;
  username?: string;
  query: string;
} {
  let cleaned = input.trim();
  // Strip email domain if entered
  if (cleaned.includes('@') && !cleaned.startsWith('@')) {
    cleaned = cleaned.split('@')[0];
  }
  cleaned = cleaned.replace(/^@/, '');

  // Handle GitHub URL
  try {
    if (
      cleaned.startsWith('http://') ||
      cleaned.startsWith('https://') ||
      cleaned.startsWith('github.com/')
    ) {
      const urlStr = cleaned.startsWith('github.com/') ? `https://${cleaned}` : cleaned;
      const url = new URL(urlStr);
      if (url.hostname.includes('github.com')) {
        const parts = url.pathname
          .replace(/^\//, '')
          .replace(/\.git$/, '')
          .split('/')
          .filter(Boolean);
        if (parts.length >= 2) {
          return { type: 'repo', owner: parts[0], repo: parts[1], query: cleaned };
        }
        if (parts.length === 1) {
          return { type: 'user', username: parts[0], query: cleaned };
        }
      }
    }
  } catch {
    // not a valid URL, continue
  }

  // Handle owner/repo
  if (cleaned.includes('/') && !cleaned.includes(' ')) {
    const parts = cleaned
      .replace(/^\//, '')
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean);
    if (parts.length === 2) {
      return { type: 'repo', owner: parts[0], repo: parts[1], query: cleaned };
    }
  }

  // Standard username
  if (/^[a-zA-Z0-9-]{1,39}$/.test(cleaned)) {
    return { type: 'user', username: cleaned, query: cleaned };
  }

  return { type: 'query', query: cleaned };
}

/**
 * Fetch a single public repository by owner and name
 */
export async function fetchSingleRepo(
  owner: string,
  repo: string,
  token?: string
): Promise<{ repo: GitHubRepo; rateLimit: RateLimitInfo }> {
  const cacheKey = `repo:${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const cached = getCached<GitHubRepo>(cacheKey);
  if (cached) return { repo: cached.data, rateLimit: cached.rateLimit };

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers }
  );

  const rateLimit = extractRateLimit(response.headers);

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubApiError(`Repository "${owner}/${repo}" was not found.`, 404, rateLimit);
    }
    if (response.status === 403) {
      const resetDate = new Date(rateLimit.reset * 1000).toLocaleTimeString();
      throw new GitHubApiError(
        `GitHub API rate limit reached (60/hr for free access). Reset at ${resetDate}. You can add an optional free token in settings to unlock 5,000 requests/hr.`,
        403,
        rateLimit
      );
    }
    throw new GitHubApiError(`GitHub API error (${response.status}): ${response.statusText}`, response.status, rateLimit);
  }

  const repoData: GitHubRepo = await response.json();
  setCache(cacheKey, repoData, rateLimit);
  return { repo: repoData, rateLimit };
}

/**
 * Search users via free GitHub Search API
 */
export async function searchGitHubUsers(
  query: string,
  token?: string
): Promise<{ users: UserSuggestion[]; rateLimit: RateLimitInfo }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(
    `https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=5`,
    { headers }
  );

  const rateLimit = extractRateLimit(response.headers);
  if (!response.ok) {
    return { users: [], rateLimit };
  }

  const data = await response.json();
  const users: UserSuggestion[] = (data.items || []).map((u: any) => ({
    login: u.login,
    avatar_url: u.avatar_url,
  }));

  return { users, rateLimit };
}

/**
 * Search repositories via free GitHub Search API
 */
export async function searchGitHubRepos(
  query: string,
  token?: string
): Promise<{ repos: GitHubRepo[]; rateLimit: RateLimitInfo }> {
  const cacheKey = `search_repos:${query.toLowerCase()}`;
  const cached = getCached<GitHubRepo[]>(cacheKey);
  if (cached) return { repos: cached.data, rateLimit: cached.rateLimit };

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`,
    { headers }
  );

  const rateLimit = extractRateLimit(response.headers);
  if (!response.ok) {
    return { repos: [], rateLimit };
  }

  const data = await response.json();
  const repos: GitHubRepo[] = (data.items || []).slice(0, 2);
  setCache(cacheKey, repos, rateLimit);
  return { repos, rateLimit };
}

/**
 * Fetch public repositories for a username
 */
export async function fetchUserRepos(
  username: string,
  token?: string
): Promise<{ repos: GitHubRepo[]; rateLimit: RateLimitInfo }> {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) {
    throw new Error('Please provide a valid GitHub username.');
  }

  const cacheKey = `user_repos:${cleanUsername.toLowerCase()}`;
  const cached = getCached<GitHubRepo[]>(cacheKey);
  if (cached) return { repos: cached.data, rateLimit: cached.rateLimit };

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=10`,
    { headers }
  );

  const rateLimit = extractRateLimit(response.headers);

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubApiError(
        `GitHub user "${cleanUsername}" was not found.`,
        404,
        rateLimit
      );
    }
    if (response.status === 403) {
      const resetDate = new Date(rateLimit.reset * 1000).toLocaleTimeString();
      throw new GitHubApiError(
        `GitHub API rate limit reached (60/hr for free access). Reset at ${resetDate}. You can add an optional free token in settings to unlock 5,000 requests/hr.`,
        403,
        rateLimit
      );
    }
    throw new GitHubApiError(
      `GitHub API error (${response.status}): ${response.statusText}`,
      response.status,
      rateLimit
    );
  }

  const allRepos: GitHubRepo[] = await response.json();
  // Limit to maximum 2 repositories display
  const repos = allRepos.slice(0, 2);
  setCache(cacheKey, repos, rateLimit);

  return { repos, rateLimit };
}

/**
 * Comprehensive Smart Query:
 * Handles usernames, owner/repo paths, URLs, and queries with automatic search fallbacks
 */
export async function fetchSmartGitHub(
  rawInput: string,
  token?: string
): Promise<{
  repos: GitHubRepo[];
  rateLimit: RateLimitInfo;
  sourceType: 'user' | 'repo' | 'search';
  suggestions?: SearchSuggestions;
}> {
  const parsed = parseGitHubInput(rawInput);

  // 1. Direct Repository specified (e.g. "facebook/react" or full URL)
  if (parsed.type === 'repo' && parsed.owner && parsed.repo) {
    const { repo, rateLimit } = await fetchSingleRepo(parsed.owner, parsed.repo, token);
    // Also try to get another repo from the same owner to give user a choice of 2
    let repos: GitHubRepo[] = [repo];
    try {
      const { repos: ownerRepos } = await fetchUserRepos(parsed.owner, token);
      const other = ownerRepos.find((r) => r.name.toLowerCase() !== parsed.repo!.toLowerCase());
      if (other) {
        repos.push(other);
      }
    } catch {
      // ignore, single repo is already found
    }
    return { repos, rateLimit, sourceType: 'repo' };
  }

  // 2. Direct Username specified
  if (parsed.type === 'user' && parsed.username) {
    try {
      const { repos, rateLimit } = await fetchUserRepos(parsed.username, token);
      if (repos.length > 0) {
        return { repos, rateLimit, sourceType: 'user' };
      }
      // User exists but has 0 public repositories: search public repos with that keyword
      const { repos: searchedRepos } = await searchGitHubRepos(parsed.username, token);
      return {
        repos: searchedRepos,
        rateLimit,
        sourceType: 'search',
        suggestions: {
          query: parsed.username,
          users: [],
          repos: searchedRepos,
        },
      };
    } catch (err: any) {
      if (err instanceof GitHubApiError && err.status === 404) {
        // User not found! Try searching for similar users and repositories via GitHub free search API
        const [{ users, rateLimit: uRl }, { repos: sRepos, rateLimit: rRl }] = await Promise.all([
          searchGitHubUsers(parsed.username, token).catch(() => ({
            users: [],
            rateLimit: err.rateLimit || { limit: 60, remaining: 0, reset: 0 },
          })),
          searchGitHubRepos(parsed.username, token).catch(() => ({
            repos: [],
            rateLimit: err.rateLimit || { limit: 60, remaining: 0, reset: 0 },
          })),
        ]);

        const suggestions: SearchSuggestions = {
          query: parsed.username,
          users,
          repos: sRepos,
        };

        // If matching repositories were found under that name, return them!
        if (sRepos.length > 0) {
          return {
            repos: sRepos,
            rateLimit: rRl || uRl || err.rateLimit!,
            sourceType: 'search',
            suggestions,
          };
        }

        // If matching users were found, return the top user's repos if possible
        if (users.length > 0) {
          try {
            const { repos: topUserRepos } = await fetchUserRepos(users[0].login, token);
            if (topUserRepos.length > 0) {
              return {
                repos: topUserRepos,
                rateLimit: uRl,
                sourceType: 'user',
                suggestions,
              };
            }
          } catch {
            // continue to throw error with suggestions
          }
        }

        throw new GitHubApiError(
          `GitHub user "${parsed.username}" was not found.`,
          404,
          err.rateLimit,
          suggestions
        );
      }
      throw err;
    }
  }

  // 3. General Query search (e.g. "react counter" or keyword)
  const { repos, rateLimit } = await searchGitHubRepos(parsed.query, token);
  if (repos.length > 0) {
    return { repos, rateLimit, sourceType: 'search' };
  }

  throw new GitHubApiError(
    `No public repositories found matching "${parsed.query}". Try searching by username (e.g. "vitejs", "facebook") or repo ("owner/repo").`,
    404,
    rateLimit
  );
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string = 'main',
  token?: string
): Promise<{ items: RepoTreeItem[]; rateLimit?: RateLimitInfo }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  // First try the provided branch
  let response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers }
  );

  // If 404 and branch is 'main', try 'master'
  if (response.status === 404 && branch === 'main') {
    response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/master?recursive=1`,
      { headers }
    );
  }

  const rateLimit = extractRateLimit(response.headers);

  if (!response.ok) {
    if (response.status === 403) {
      throw new GitHubApiError('GitHub API rate limit exceeded while loading repository tree.', 403, rateLimit);
    }
    if (response.status === 404) {
      throw new GitHubApiError(`Repository "${owner}/${repo}" or its branch could not be found.`, 404, rateLimit);
    }
    throw new GitHubApiError(`Failed to fetch file tree: ${response.statusText}`, response.status, rateLimit);
  }

  const data = await response.json();
  const items: RepoTreeItem[] = (data.tree || []).map((t: any) => ({
    path: t.path,
    mode: t.mode,
    type: t.type === 'tree' ? 'tree' : 'blob',
    sha: t.sha,
    size: t.size,
    url: t.url,
  }));

  return { items, rateLimit };
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main',
  token?: string
): Promise<string> {
  // If no token, raw.githubusercontent.com is faster and has separate/higher rate limits
  if (!token) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      const res = await fetch(rawUrl);
      if (res.ok) {
        return await res.text();
      }
      // If branch was main and failed, try master
      if (branch === 'main') {
        const rawMaster = `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}`;
        const resMaster = await fetch(rawMaster);
        if (resMaster.ok) {
          return await resMaster.text();
        }
      }
    } catch {
      // fallback to GitHub API
    }
  }

  // Fallback to GitHub Contents API
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`Failed to load file content (${res.status}): ${path}`);
  }

  const data = await res.json();
  if (data.encoding === 'base64' && data.content) {
    try {
      // Decode UTF-8 base64
      const binaryString = atob(data.content.replace(/\s/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch {
      return atob(data.content);
    }
  }

  return data.content || '';
}

export function buildFileTree(items: RepoTreeItem[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  // Sort paths so folders and files are ordered naturally
  const sorted = [...items].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sorted) {
    const parts = item.path.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      let existing = currentLevel.find((node) => node.name === part);

      if (!existing) {
        const isFolder = !isLast || item.type === 'tree';
        const newNode: FileTreeNode = {
          name: part,
          path: currentPath,
          type: isFolder ? 'folder' : 'file',
          size: isLast ? item.size : undefined,
          sha: isLast ? item.sha : undefined,
          children: isFolder ? [] : undefined,
        };
        currentLevel.push(newNode);
        existing = newNode;
      }

      if (existing.type === 'folder' && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  // Recursive sort: folders first, then files alphabetically
  function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
    return nodes;
  }

  return sortNodes(root);
}

export function analyzeProject(
  files: RepoTreeItem[],
  packageJsonRaw?: string
): ProjectAnalysis {
  const filePaths = new Set(files.map((f) => f.path.toLowerCase()));
  const warnings: string[] = [];
  let dependencies: Record<string, string> = {};

  let parsedPackageJson: any = null;
  if (packageJsonRaw) {
    try {
      parsedPackageJson = JSON.parse(packageJsonRaw);
      dependencies = {
        ...(parsedPackageJson.dependencies || {}),
        ...(parsedPackageJson.devDependencies || {}),
      };
    } catch {
      warnings.push('Could not parse package.json as valid JSON.');
    }
  }

  // 1. Check for React + Vite project first
  const hasViteConfig = Array.from(filePaths).some((p) =>
    p.startsWith('vite.config.')
  );
  const hasReact = !!(dependencies['react'] || dependencies['react-dom']);
  const hasVite = !!dependencies['vite'] || hasViteConfig;
  const hasReactFiles = Array.from(filePaths).some((p) =>
    p.endsWith('.tsx') || p.endsWith('.jsx')
  );
  const hasFrontendStructure =
    hasReact ||
    (hasVite && hasReactFiles) ||
    hasViteConfig ||
    filePaths.has('src/app.tsx') ||
    filePaths.has('src/app.jsx') ||
    filePaths.has('src/main.tsx') ||
    filePaths.has('src/main.jsx') ||
    filePaths.has('src/index.tsx') ||
    filePaths.has('src/index.jsx');

  // Backend server indicators (Express, Node servers, MongoDB, Python, etc.)
  const backendPkgs = [
    'express',
    'mongodb',
    'mongoose',
    'pg',
    'mysql',
    'mysql2',
    'sqlite3',
    'fastify',
    'koa',
    'nestjs',
    '@nestjs/core',
    'typeorm',
    'prisma',
    '@prisma/client',
  ];

  const foundBackendPkgs = backendPkgs.filter((pkg) => dependencies[pkg]);

  const hasServerFiles = [
    'server.js',
    'server.ts',
    'app.js',
    'app.ts',
    'index.js',
    'index.ts',
  ].some((s) => {
    return (
      filePaths.has(s) &&
      (foundBackendPkgs.length > 0 ||
        filePaths.has('server/') ||
        filePaths.has('backend/') ||
        s === 'server.ts' ||
        s === 'server.js')
    );
  });

  const hasPythonBackend = Array.from(filePaths).some(
    (p) => p.endsWith('.py') || p === 'requirements.txt' || p === 'manage.py'
  );
  const hasJavaOrGoBackend = Array.from(filePaths).some(
    (p) => p.endsWith('.go') || p.endsWith('.java') || p === 'pom.xml'
  );

  // If the repository has a React frontend structure
  if (hasFrontendStructure) {
    let entry = 'src/main.tsx';
    if (filePaths.has('src/main.jsx')) entry = 'src/main.jsx';
    else if (filePaths.has('src/index.tsx')) entry = 'src/index.tsx';
    else if (filePaths.has('src/index.jsx')) entry = 'src/index.jsx';
    else if (filePaths.has('src/app.tsx')) entry = 'src/App.tsx';
    else if (filePaths.has('src/app.jsx')) entry = 'src/App.jsx';
    else if (filePaths.has('index.html')) entry = 'index.html';

    const hasBackendComponents =
      foundBackendPkgs.length > 0 || hasServerFiles || hasPythonBackend || hasJavaOrGoBackend;

    return {
      type: 'react-vite',
      title: hasBackendComponents
        ? 'React + Vite (Full-Stack / Frontend Runnable)'
        : 'React + Vite Application',
      description: hasBackendComponents
        ? 'Full-stack application detected with client-side React UI. The React frontend is fully runnable in the browser runner. (Server-side endpoints in server.ts/express run on backend).'
        : 'Modern client-side React application. Dependencies will be resolved and transpiled directly in-browser using virtual ES module maps and Babel.',
      entryPoint: entry,
      isRunnable: true,
      dependencies,
      warnings: hasBackendComponents
        ? [
            `Client-side React frontend is runnable in browser. Backend endpoints (${foundBackendPkgs.join(', ') || 'server.ts'}) are hosted separately.`,
          ]
        : warnings,
    };
  }

  // 2. Check for standard HTML/CSS/JS project
  const hasIndexHtml = filePaths.has('index.html');
  const anyHtmlFile = Array.from(filePaths).find((p) => p.endsWith('.html'));

  if (hasIndexHtml || anyHtmlFile) {
    const hasBackendComponents =
      foundBackendPkgs.length > 0 || hasServerFiles || hasPythonBackend || hasJavaOrGoBackend;

    return {
      type: 'html',
      title: hasBackendComponents
        ? 'HTML Web Project (Frontend Runnable)'
        : 'HTML / CSS / JavaScript Project',
      description:
        'Standard client-side web project. Runs directly in an isolated, sandboxed virtual browser runtime.',
      entryPoint: hasIndexHtml ? 'index.html' : anyHtmlFile,
      isRunnable: true,
      dependencies,
      warnings: hasBackendComponents
        ? ['Running client HTML in browser sandbox (backend files hosted separately).']
        : warnings,
    };
  }

  // 3. Pure backend server (Express API, Node CLI, Python, Java with NO frontend UI)
  if (
    foundBackendPkgs.length > 0 ||
    hasServerFiles ||
    hasPythonBackend ||
    hasJavaOrGoBackend
  ) {
    const reasons: string[] = [];
    if (foundBackendPkgs.length > 0) {
      reasons.push(`Dependencies: ${foundBackendPkgs.join(', ')}`);
    }
    if (hasPythonBackend) reasons.push('Python / Django / Flask backend');
    if (hasJavaOrGoBackend) reasons.push('Go / Java backend');
    if (hasServerFiles && foundBackendPkgs.length === 0) {
      reasons.push('Node.js server files detected without client HTML/React UI');
    }

    return {
      type: 'unsupported-backend',
      title: 'Server-side / Backend Application',
      description:
        'This repository appears to be a pure server-side/backend application without a client-side HTML or React UI. Browser execution is strictly limited to web client frontends. You can inspect and edit all code in the Monaco Editor.',
      isRunnable: false,
      dependencies,
      warnings: reasons,
    };
  }

  // 4. Unknown / generic files
  return {
    type: 'unknown',
    title: 'Static Code Repository',
    description:
      'No standard web entry point (index.html or React+Vite structure) was detected. You can view, explore, and edit files in Monaco Editor.',
    isRunnable: false,
    dependencies,
    warnings: ['No index.html or React entry point found.'],
  };
}
