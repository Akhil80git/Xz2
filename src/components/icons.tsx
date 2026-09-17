import React from 'react';
import {
  FileCode,
  FileJson,
  FileText,
  FileImage,
  Folder,
  FolderOpen,
  FileType,
  File,
} from 'lucide-react';

export function getFileIcon(fileName: string, isFolder = false, isOpen = false) {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
    ) : (
      <Folder className="w-4 h-4 text-amber-400 shrink-0" />
    );
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'html':
      return <FileCode className="w-4 h-4 text-orange-500 shrink-0" />;
    case 'css':
    case 'scss':
    case 'less':
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'js':
    case 'jsx':
    case 'mjs':
      return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
    case 'ts':
    case 'tsx':
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    case 'json':
      return <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'md':
    case 'txt':
    case 'markdown':
      return <FileText className="w-4 h-4 text-zinc-400 shrink-0" />;
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return <FileImage className="w-4 h-4 text-purple-400 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-zinc-400 shrink-0" />;
  }
}

export function getMonacoLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'svg':
    case 'xml':
      return 'xml';
    case 'py':
      return 'python';
    case 'sh':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}
