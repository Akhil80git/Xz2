import React, { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  X,
  RotateCcw,
  Code2,
  FileText,
  Check,
  Play,
  Save,
  Loader2,
} from 'lucide-react';
import { VirtualFile } from '../types';
import { getFileIcon, getMonacoLanguage } from './icons';

interface CodeEditorProps {
  openFiles: string[];
  activeFilePath: string | null;
  virtualFiles: Map<string, VirtualFile>;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (path: string, newContent: string) => void;
  onRevertFile: (path: string) => void;
  isLoadingFile: boolean;
  onRun: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  openFiles,
  activeFilePath,
  virtualFiles,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onRevertFile,
  isLoadingFile,
  onRun,
}) => {
  const activeFile = activeFilePath ? virtualFiles.get(activeFilePath) : undefined;
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add Ctrl+Enter or Cmd+Enter shortcut to Run project
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun();
    });

    // Add Ctrl+S or Cmd+S shortcut to save in memory
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Nothing needed on server since it's in-browser memory
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFilePath && value !== undefined) {
      onChangeContent(activeFilePath, value);
    }
  };

  const activeFileName = activeFilePath ? activeFilePath.split('/').pop() || activeFilePath : '';
  const language = activeFilePath ? getMonacoLanguage(activeFilePath) : 'plaintext';

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-zinc-300">
      {/* Top Tab Bar */}
      <div className="flex items-center bg-zinc-900 border-b border-zinc-800 overflow-x-auto no-scrollbar select-none min-h-[36px]">
        {openFiles.length === 0 ? (
          <div className="px-3 py-2 text-xs text-zinc-500 italic">
            No files opened
          </div>
        ) : (
          openFiles.map((path) => {
            const fileName = path.split('/').pop() || path;
            const file = virtualFiles.get(path);
            const isActive = activeFilePath === path;
            const isModified = file?.isModified;

            return (
              <div
                key={path}
                onClick={() => onSelectTab(path)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-zinc-800 cursor-pointer transition-colors max-w-[200px] shrink-0 ${
                  isActive
                    ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500 font-medium'
                    : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200 border-t-2 border-t-transparent'
                }`}
                title={path}
              >
                {getFileIcon(fileName)}
                <span className="truncate tracking-tight">{fileName}</span>

                {isModified ? (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-1"
                    title="Unsaved changes"
                  />
                ) : null}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(path);
                  }}
                  className="p-0.5 rounded hover:bg-zinc-700/80 text-zinc-500 hover:text-zinc-200 ml-1 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Close file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Editor Main Content or Empty State */}
      <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
        {isLoadingFile ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1e1e1e] text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Loading {activeFileName}...</span>
          </div>
        ) : !activeFilePath || !activeFile ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 select-none">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
              <Code2 className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">
              No File Selected
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-6 leading-relaxed">
              Select a file from the Explorer on the left to inspect, edit, or run the project in the browser.
            </p>

            <div className="grid grid-cols-2 gap-3 text-left max-w-xs text-xs bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 text-zinc-400">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Run Code</span>
                <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] font-mono text-zinc-200">
                  Ctrl + Enter
                </kbd>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Switch Files</span>
                <span className="text-zinc-300 text-[11px]">Click in tree</span>
              </div>
            </div>
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            value={activeFile.content}
            theme="vs-dark"
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 13,
              fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
              fontLigatures: true,
              minimap: { enabled: true, maxColumn: 80 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              renderLineHighlight: 'all',
              fixedOverflowWidgets: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 12, bottom: 12 },
            }}
          />
        )}
      </div>

      {/* Editor Status Bar */}
      {activeFilePath && activeFile && (
        <div className="px-3 py-1 bg-zinc-900 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <span className="truncate max-w-[300px] text-zinc-300">
              {activeFilePath}
            </span>
            {activeFile.isModified && (
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-medium">Modified</span>
                <button
                  type="button"
                  onClick={() => onRevertFile(activeFilePath)}
                  className="px-1.5 py-0.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded flex items-center gap-1 transition-colors cursor-pointer"
                  title="Revert to original GitHub version"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Revert</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-zinc-500 font-mono">
            <span className="uppercase">{language}</span>
            <span>UTF-8</span>
            <span>Spaces: 2</span>
          </div>
        </div>
      )}
    </div>
  );
};
