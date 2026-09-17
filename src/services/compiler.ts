import * as Babel from '@babel/standalone';
import { VirtualFile } from '../types';

export interface CompilationResult {
  success: boolean;
  html: string;
  error?: string;
  logs: string[];
}

// Normalize path separators to forward slashes and clean leading/trailing slashes
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

// Resolve relative import path from a base file path
export function resolveRelativePath(basePath: string, relativePath: string): string {
  const cleanRelative = relativePath.trim();
  if (!cleanRelative.startsWith('.')) {
    return cleanRelative;
  }

  const baseParts = normalizePath(basePath).split('/');
  baseParts.pop(); // remove file name, keep directory

  const relParts = cleanRelative.split('/');
  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

// Find a matching file in virtual files, checking common extensions
export function findVirtualFile(
  files: Map<string, VirtualFile>,
  targetPath: string
): VirtualFile | undefined {
  const normalized = normalizePath(targetPath);
  if (files.has(normalized)) return files.get(normalized);

  const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css', '.html'];
  for (const ext of extensions) {
    if (files.has(normalized + ext)) return files.get(normalized + ext);
  }

  // Check index files inside directories
  for (const ext of extensions) {
    const indexPath = `${normalized}/index${ext}`;
    if (files.has(indexPath)) return files.get(indexPath);
  }

  return undefined;
}

// Script injected into every sandbox iframe to intercept console and errors
const CONSOLE_INTERCEPTOR_SCRIPT = `
(function() {
  function serialize(obj) {
    try {
      if (obj === null) return 'null';
      if (obj === undefined) return 'undefined';
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
      if (obj instanceof Error) return obj.name + ': ' + obj.message + (obj.stack ? '\\n' + obj.stack : '');
      if (typeof obj === 'object') {
        return JSON.stringify(obj, function(key, val) {
          if (typeof val === 'function') return '[Function ' + (val.name || 'anonymous') + ']';
          if (val instanceof Element) return '<' + val.tagName.toLowerCase() + '>';
          return val;
        }, 2);
      }
      return String(obj);
    } catch(e) {
      return String(obj);
    }
  }

  function sendLog(level, args) {
    try {
      var serializedArgs = Array.prototype.slice.call(args).map(serialize);
      window.parent.postMessage({
        source: 'github-runner-sandbox',
        type: 'CONSOLE_LOG',
        level: level,
        message: serializedArgs.join(' '),
        details: serializedArgs,
        timestamp: new Date().toISOString()
      }, '*');
    } catch(e) {}
  }

  var originalLog = console.log;
  var originalWarn = console.warn;
  var originalError = console.error;
  var originalInfo = console.info;

  console.log = function() { originalLog.apply(console, arguments); sendLog('log', arguments); };
  console.warn = function() { originalWarn.apply(console, arguments); sendLog('warn', arguments); };
  console.error = function() { originalError.apply(console, arguments); sendLog('error', arguments); };
  console.info = function() { originalInfo.apply(console, arguments); sendLog('info', arguments); };

  window.addEventListener('error', function(event) {
    sendLog('error', [event.error || event.message]);
  });

  window.addEventListener('unhandledrejection', function(event) {
    sendLog('error', ['Unhandled Promise Rejection:', event.reason]);
  });
})();
`;

/**
 * Builds HTML for Vanilla HTML/CSS/JS projects
 */
export async function compileHtmlProject(
  virtualFiles: Map<string, VirtualFile>,
  entryPath: string = 'index.html'
): Promise<CompilationResult> {
  const logs: string[] = [];
  logs.push(`Analyzing project structure with entry: ${entryPath}`);

  let indexFile = findVirtualFile(virtualFiles, entryPath);
  if (!indexFile) {
    // Look for any .html file
    for (const [path, file] of virtualFiles.entries()) {
      if (path.endsWith('.html')) {
        indexFile = file;
        break;
      }
    }
  }

  if (!indexFile) {
    return {
      success: false,
      html: '',
      error: `Could not find an HTML entry point (like index.html). Please ensure the repository contains an HTML file.`,
      logs,
    };
  }

  let htmlContent = indexFile.content;

  // Replace <link rel="stylesheet" href="..."> with inline styles or resolved styles
  htmlContent = htmlContent.replace(
    /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    (match, href) => {
      const cssPath = resolveRelativePath(indexFile!.path, href);
      const cssFile = findVirtualFile(virtualFiles, cssPath);
      if (cssFile) {
        logs.push(`Inlined stylesheet: ${href}`);
        return `<style data-source="${href}">\n${cssFile.content}\n</style>`;
      }
      return match;
    }
  );

  // Replace <script src="..."> with inline script or resolved script
  htmlContent = htmlContent.replace(
    /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (match, src) => {
      // Don't replace external http/https scripts
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
        return match;
      }
      const jsPath = resolveRelativePath(indexFile!.path, src);
      const jsFile = findVirtualFile(virtualFiles, jsPath);
      if (jsFile) {
        logs.push(`Inlined script: ${src}`);
        return `<script data-source="${src}">\n${jsFile.content}\n</script>`;
      }
      return match;
    }
  );

  // Inject console interceptor
  const injectedScript = `<script>${CONSOLE_INTERCEPTOR_SCRIPT}</script>`;
  if (htmlContent.includes('<head>')) {
    htmlContent = htmlContent.replace('<head>', `<head>\n${injectedScript}`);
  } else if (htmlContent.includes('<html>')) {
    htmlContent = htmlContent.replace('<html>', `<html><head>${injectedScript}</head>`);
  } else {
    htmlContent = `${injectedScript}\n${htmlContent}`;
  }

  logs.push('HTML project packaged successfully into sandboxed runner.');

  return {
    success: true,
    html: htmlContent,
    logs,
  };
}

/**
 * Builds HTML for React + Vite projects
 */
export async function compileReactViteProject(
  virtualFiles: Map<string, VirtualFile>,
  entryPath: string = 'src/main.tsx',
  dependencies: Record<string, string> = {}
): Promise<CompilationResult> {
  const logs: string[] = [];
  logs.push(`Starting in-browser React+Vite compilation...`);

  // Detect index.html or fallback to standard React template
  let baseHtml = '';
  const htmlFile = findVirtualFile(virtualFiles, 'index.html');
  if (htmlFile) {
    baseHtml = htmlFile.content;
  } else {
    baseHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
  }

  // Ensure <div id="root"></div> exists
  if (!baseHtml.includes('id="root"') && !baseHtml.includes('id="app"')) {
    baseHtml = baseHtml.replace('</body>', '<div id="root"></div>\n</body>');
  }

  // Clean out original script tag from HTML (e.g. <script type="module" src="/src/main.tsx"></script>)
  baseHtml = baseHtml.replace(/<script\s+type=["']module["']\s+src=["'][^"']+["']\s*>\s*<\/script>/gi, '');

  // Extract all CSS files in project and inject them
  let injectedStyles = '';
  for (const [path, file] of virtualFiles.entries()) {
    if (path.endsWith('.css')) {
      logs.push(`Bundling stylesheet: ${path}`);
      injectedStyles += `\n/* ${path} */\n${file.content}\n`;
    }
  }

  // Check if project uses Tailwind
  const usesTailwind =
    virtualFiles.has('tailwind.config.js') ||
    virtualFiles.has('tailwind.config.ts') ||
    Object.keys(dependencies).some((d) => d.includes('tailwind')) ||
    injectedStyles.includes('@tailwind') ||
    injectedStyles.includes('@import "tailwindcss"');

  let tailwindCdn = '';
  if (usesTailwind) {
    logs.push('Detected Tailwind CSS - enabling browser Tailwind engine.');
    tailwindCdn = `<script src="https://cdn.tailwindcss.com"></script>`;
  }

  // Prepare external package import maps
  // Standard React + React DOM mappings
  const importMapImports: Record<string, string> = {
    react: 'https://esm.sh/react@18.3.1?dev',
    'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime?dev',
    'react/jsx-dev-runtime': 'https://esm.sh/react@18.3.1/jsx-dev-runtime?dev',
    'react-dom': 'https://esm.sh/react-dom@18.3.1?dev',
    'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?dev',
  };

  // Add other dependencies from package.json
  for (const [pkg, version] of Object.entries(dependencies)) {
    if (pkg.startsWith('@types/') || pkg === 'vite' || pkg === '@vitejs/plugin-react') {
      continue;
    }
    if (pkg === 'react' || pkg === 'react-dom') {
      // Keep react 18 for seamless esm.sh browser compatibility
      continue;
    }

    const cleanVer = version.replace(/^[\^~>=<]/, '').trim();
    const verParam = cleanVer ? `@${cleanVer}` : '';
    importMapImports[pkg] = `https://esm.sh/${pkg}${verParam}?bundle`;
    importMapImports[`${pkg}/`] = `https://esm.sh/${pkg}${verParam}/`;
  }

  logs.push(`Configured ${Object.keys(importMapImports).length} module mappings in importmap.`);

  // Find all JS/TS/TSX/JSX files in virtualFiles to transpile
  const transpiledBlobs: Record<string, string> = {};
  const localFilesToTranspile: { path: string; file: VirtualFile }[] = [];

  for (const [path, file] of virtualFiles.entries()) {
    if (
      (path.endsWith('.tsx') ||
        path.endsWith('.ts') ||
        path.endsWith('.jsx') ||
        path.endsWith('.js')) &&
      !path.endsWith('.d.ts') &&
      !path.startsWith('node_modules/')
    ) {
      localFilesToTranspile.push({ path, file });
    }
  }

  // Transpile files using Babel Standalone
  logs.push(`Transpiling ${localFilesToTranspile.length} TypeScript/React source files...`);

  // Step 1: Transpile each file into browser ES modules
  const transpiledFiles = new Map<string, string>();

  for (const { path, file } of localFilesToTranspile) {
    try {
      // Remove raw CSS imports like import './App.css'; because browser ES modules will fail to import CSS
      let code = file.content.replace(/import\s+['"][^'"]+\.css['"]\s*;?/g, '/* css import bundled */');
      
      // Transform with Babel
      const isTs = path.endsWith('.ts') || path.endsWith('.tsx');
      const isJsx = path.endsWith('.tsx') || path.endsWith('.jsx');

      const presets: any[] = [];
      if (isTs) {
        presets.push(['typescript', { isTSX: isJsx, allExtensions: true }]);
      }
      presets.push([
        'react',
        {
          runtime: 'automatic',
          importSource: 'react',
        },
      ]);

      const result = Babel.transform(code, {
        presets,
        filename: path,
        sourceType: 'module',
      });

      if (result.code) {
        transpiledFiles.set(normalizePath(path), result.code);
      }
    } catch (err: any) {
      logs.push(`Transpilation error in ${path}: ${err.message}`);
      return {
        success: false,
        html: '',
        error: `Compilation error in ${path}: ${err.message}`,
        logs,
      };
    }
  }

  // Step 2: Rewrite relative imports to point to Blob URLs or matching paths
  // First, create temporary blob URLs for all transpiled files
  const fileToBlobUrl = new Map<string, string>();

  for (const [path, code] of transpiledFiles.entries()) {
    // Rewrite internal relative imports inside this file:
    // e.g. import App from './App' -> import App from '<blobUrl>'
    let transformedCode = code.replace(
      /(from\s+['"]|import\s*\(\s*['"]|import\s+['"])([\.\/][^'"]+)(['"])/g,
      (match, prefix, importPath, suffix) => {
        const resolved = resolveRelativePath(path, importPath);

        // Check if there is a transpiled file matching this path
        let targetKey: string | undefined;
        const candidates = [
          resolved,
          `${resolved}.tsx`,
          `${resolved}.ts`,
          `${resolved}.jsx`,
          `${resolved}.js`,
          `${resolved}/index.tsx`,
          `${resolved}/index.ts`,
          `${resolved}/index.jsx`,
          `${resolved}/index.js`,
        ];

        for (const candidate of candidates) {
          const norm = normalizePath(candidate);
          if (transpiledFiles.has(norm)) {
            targetKey = norm;
            break;
          }
        }

        if (targetKey) {
          // Point to virtual route in our import map or root URL
          return `${prefix}/virtual/${targetKey}${suffix}`;
        }

        return match;
      }
    );

    const blob = new Blob([transformedCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    fileToBlobUrl.set(path, blobUrl);
  }

  // Map every virtual file path to its blob URL in the import map
  for (const [path, blobUrl] of fileToBlobUrl.entries()) {
    importMapImports[`/virtual/${path}`] = blobUrl;
    importMapImports[`./virtual/${path}`] = blobUrl;
    importMapImports[`/${path}`] = blobUrl;
    importMapImports[`./${path}`] = blobUrl;
    // Also map extensionless variants
    const withoutExt = path.replace(/\.[^/.]+$/, '');
    importMapImports[`/virtual/${withoutExt}`] = blobUrl;
    importMapImports[`./virtual/${withoutExt}`] = blobUrl;
  }

  // Determine actual entry point
  let actualEntryPath = normalizePath(entryPath);
  if (!transpiledFiles.has(actualEntryPath)) {
    const candidates = [
      'src/main.tsx',
      'src/main.jsx',
      'src/index.tsx',
      'src/index.jsx',
      'src/App.tsx',
      'src/App.jsx',
      'main.tsx',
      'main.jsx',
      'index.tsx',
      'index.jsx',
      'App.tsx',
      'App.jsx',
    ];
    for (const c of candidates) {
      if (transpiledFiles.has(c)) {
        actualEntryPath = c;
        break;
      }
    }
  }

  const entryBlobUrl = fileToBlobUrl.get(actualEntryPath);
  if (!entryBlobUrl) {
    return {
      success: false,
      html: '',
      error: `Could not find a valid React entry point (such as src/main.tsx, src/index.tsx, or src/App.tsx). Available files: ${Array.from(
        transpiledFiles.keys()
      ).join(', ')}`,
      logs,
    };
  }

  logs.push(`Mounted main entry point: ${actualEntryPath}`);

  // Build the complete runner HTML
  const importMapJson = JSON.stringify({ imports: importMapImports }, null, 2);

  const headInjections = `
    <script type="importmap">
${importMapJson}
    </script>
    ${tailwindCdn}
    <style>
      ${injectedStyles}
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
    </style>
    <script>${CONSOLE_INTERCEPTOR_SCRIPT}</script>
  `;

  let finalHtml = baseHtml;
  if (finalHtml.includes('<head>')) {
    finalHtml = finalHtml.replace('<head>', `<head>\n${headInjections}`);
  } else {
    finalHtml = `<head>\n${headInjections}\n</head>\n${finalHtml}`;
  }

  const runnerScript = `
    <script type="module">
      import '${entryBlobUrl}';
    </script>
  `;

  if (finalHtml.includes('</body>')) {
    finalHtml = finalHtml.replace('</body>', `${runnerScript}\n</body>`);
  } else {
    finalHtml = `${finalHtml}\n${runnerScript}`;
  }

  logs.push('React+Vite project successfully packaged into sandboxed execution bundle.');

  return {
    success: true,
    html: finalHtml,
    logs,
  };
}
