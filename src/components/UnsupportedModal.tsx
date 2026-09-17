import React from 'react';
import { AlertTriangle, Server, X, ShieldAlert, Code2 } from 'lucide-react';
import { ProjectAnalysis } from '../types';

interface UnsupportedModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ProjectAnalysis | null;
}

export const UnsupportedModal: React.FC<UnsupportedModalProps> = ({
  isOpen,
  onClose,
  analysis,
}) => {
  if (!isOpen || !analysis) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-amber-950/40">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-semibold">
              Unsupported Project Type
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs text-zinc-300">
          <p className="leading-relaxed">
            {analysis.description}
          </p>

          {analysis.warnings.length > 0 && (
            <div className="p-3 bg-zinc-950/80 rounded border border-zinc-800 space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 block uppercase">
                Detected Backend Components:
              </span>
              <ul className="list-disc list-inside text-zinc-400 space-y-0.5 font-mono text-[11px]">
                {analysis.warnings.map((w, idx) => (
                  <li key={idx} className="text-amber-300">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-lg flex items-start gap-2.5 text-blue-300 text-[11px]">
            <Code2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-200 block mb-0.5">
                Full Code Viewing & Editing Remains Available
              </span>
              You can still browse the full file directory, view code, and make edits inside Monaco Editor.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-zinc-950/60 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-medium transition-colors cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
