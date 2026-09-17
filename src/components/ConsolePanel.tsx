import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  X,
  Filter,
} from 'lucide-react';
import { ConsoleLogMessage } from '../types';

interface ConsolePanelProps {
  logs: ConsoleLogMessage[];
  onClearLogs: () => void;
  onClose: () => void;
}

type LogFilter = 'all' | 'error' | 'warn' | 'info' | 'system';

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  logs,
  onClearLogs,
  onClose,
}) => {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.type === 'error';
    if (filter === 'warn') return log.type === 'warn';
    if (filter === 'info') return log.type === 'info' || log.type === 'log';
    if (filter === 'system') return log.type === 'system';
    return true;
  });

  const errorCount = logs.filter((l) => l.type === 'error').length;
  const warnCount = logs.filter((l) => l.type === 'warn').length;

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-t border-zinc-800 text-zinc-300 font-mono text-xs select-text">
      {/* Console Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-zinc-200">Terminal & Output</span>

          {/* Counts */}
          <div className="flex items-center gap-1.5 text-[11px] ml-2">
            {errorCount > 0 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-red-950/70 border border-red-800/80 rounded text-red-400">
                <AlertCircle className="w-3 h-3" />
                {errorCount}
              </span>
            )}
            {warnCount > 0 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-950/70 border border-amber-800/80 rounded text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {warnCount}
              </span>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 text-[11px]">
          {(['all', 'error', 'warn', 'info', 'system'] as LogFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-colors disabled:opacity-40 cursor-pointer"
            title="Copy all logs"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-colors disabled:opacity-40 cursor-pointer"
            title="Clear console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-colors cursor-pointer"
            title="Hide console panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Output Stream */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-zinc-950">
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-600 italic p-3 text-center">
            {logs.length === 0
              ? 'No console output yet. Click "Run" to build and execute code.'
              : 'No logs match the selected filter.'}
          </div>
        ) : (
          filteredLogs.map((log) => {
            let textColor = 'text-zinc-300';
            let icon = <Info className="w-3 h-3 text-zinc-500 shrink-0" />;

            if (log.type === 'error') {
              textColor = 'text-red-400 bg-red-950/20';
              icon = <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />;
            } else if (log.type === 'warn') {
              textColor = 'text-amber-300 bg-amber-950/20';
              icon = <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
            } else if (log.type === 'system') {
              textColor = 'text-blue-300 bg-blue-950/20';
              icon = <Terminal className="w-3 h-3 text-blue-400 shrink-0" />;
            }

            return (
              <div
                key={log.id}
                className={`flex items-start gap-2 py-0.5 px-1.5 rounded leading-relaxed border border-transparent hover:border-zinc-800 ${textColor}`}
              >
                <span className="text-[10px] text-zinc-600 shrink-0 font-mono mt-0.5">
                  {log.timestamp}
                </span>
                <span className="mt-0.5">{icon}</span>
                <span className="flex-1 whitespace-pre-wrap break-all">
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
