import React, { useState, useRef } from 'react';
import {
  RotateCw,
  Maximize2,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
  AlertCircle,
  Play,
  Layers,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { CompilationResult } from '../services/compiler';
import { ProjectAnalysis } from '../types';

interface PreviewPanelProps {
  compilation: CompilationResult | null;
  isRunning: boolean;
  onRun: () => void;
  projectAnalysis: ProjectAnalysis | null;
  onClose?: () => void;
}

type ViewportMode = 'responsive' | 'tablet' | 'mobile';

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  compilation,
  isRunning,
  onRun,
  projectAnalysis,
  onClose,
}) => {
  const [viewport, setViewport] = useState<ViewportMode>('responsive');
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenNewWindow = () => {
    if (!compilation?.html) return;
    const blob = new Blob([compilation.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800 text-zinc-300">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 min-h-[36px] select-none">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-zinc-200">
            Live Preview
          </span>

          {/* Sandbox Security Badge */}
          <div
            className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded"
            title="Isolated iframe sandbox without same-origin privileges: code cannot access credentials, cookies, or host DOM."
          >
            <ShieldCheck className="w-3 h-3" />
            <span className="hidden sm:inline">Sandboxed</span>
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
          <button
            type="button"
            onClick={() => setViewport('responsive')}
            className={`p-1 rounded text-xs transition-colors cursor-pointer ${
              viewport === 'responsive'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Desktop / Full Width"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewport('tablet')}
            className={`p-1 rounded text-xs transition-colors cursor-pointer ${
              viewport === 'tablet'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Tablet (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`p-1 rounded text-xs transition-colors cursor-pointer ${
              viewport === 'mobile'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Mobile (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!compilation?.html || isRunning}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title="Reload Preview"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleOpenNewWindow}
            disabled={!compilation?.html}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title="Open preview in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Preview Frame or Empty State */}
      <div className="flex-1 relative overflow-auto bg-zinc-950 flex items-center justify-center p-2">
        {isRunning ? (
          <div className="flex flex-col items-center justify-center gap-3 text-zinc-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
            <div className="text-center">
              <p className="text-xs font-medium text-zinc-200">
                Compiling project in browser...
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Transpiling code & resolving virtual modules
              </p>
            </div>
          </div>
        ) : compilation && !compilation.success ? (
          <div className="max-w-md p-5 bg-red-950/40 border border-red-800/80 rounded-xl text-red-200 text-xs shadow-lg">
            <div className="flex items-start gap-2.5 mb-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-red-300">
                  Build Failed
                </h4>
                <p className="text-[11px] text-red-400/80 mt-0.5">
                  Error encountered during in-browser compilation
                </p>
              </div>
            </div>

            <pre className="p-3 bg-zinc-950/80 rounded border border-red-900/50 text-red-300 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto max-h-48">
              {compilation.error}
            </pre>

            <button
              type="button"
              onClick={onRun}
              className="mt-3.5 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Build</span>
            </button>
          </div>
        ) : compilation && compilation.html ? (
          <div
            style={{
              width: getViewportWidth(),
              height: '100%',
              maxWidth: '100%',
              transition: 'width 0.2s ease-in-out',
            }}
            className="h-full bg-white rounded shadow-md overflow-hidden relative"
          >
            {/* Sandboxed iframe with NO allow-same-origin for strict isolation */}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={compilation.html}
              title="Project Sandbox Runner"
              sandbox="allow-scripts allow-modals allow-forms"
              className="w-full h-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 select-none max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
              <Play className="w-6 h-6 text-emerald-500 fill-emerald-500 ml-0.5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">
              Ready to Run
            </h3>
            <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
              {projectAnalysis?.type === 'unsupported-backend'
                ? 'Backend application detected. Only frontend HTML/JS and React+Vite projects can be executed in the browser.'
                : 'Click "Run" to build and execute the repository inside an isolated, secure browser sandbox.'}
            </p>

            {projectAnalysis?.type !== 'unsupported-backend' && (
              <button
                type="button"
                onClick={onRun}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Project Now</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
