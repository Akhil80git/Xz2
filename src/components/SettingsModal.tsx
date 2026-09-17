import React, { useState } from 'react';
import { X, Key, Shield, Info, ExternalLink, Check, Trash2 } from 'lucide-react';
import { RateLimitInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSaveToken: (token: string) => void;
  rateLimit: RateLimitInfo | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  token,
  onSaveToken,
  rateLimit,
}) => {
  const [inputVal, setInputVal] = useState(token);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveToken(inputVal.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  const handleClear = () => {
    setInputVal('');
    onSaveToken('');
  };

  const resetTime = rateLimit?.reset
    ? new Date(rateLimit.reset * 1000).toLocaleTimeString()
    : 'Unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">
              GitHub API & Token Settings
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

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4">
          {/* Rate Limit Status Card */}
          <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-zinc-400 font-medium">
              <span>GitHub API Rate Limit</span>
              <span className="font-mono text-zinc-200">
                {rateLimit ? `${rateLimit.remaining} / ${rateLimit.limit}` : 'Checking...'}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (rateLimit?.remaining || 0) < 10
                    ? 'bg-red-500'
                    : (rateLimit?.remaining || 0) < 30
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{
                  width: `${rateLimit ? (rateLimit.remaining / rateLimit.limit) * 100 : 100}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span>Resets at: {resetTime}</span>
              <span>{token ? 'Authenticated (5,000/hr)' : 'Public IP (60/hr)'}</span>
            </div>
          </div>

          {/* Token input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Personal Access Token (Optional)
            </label>
            <input
              type="password"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono"
            />
            <p className="text-[11px] text-zinc-500 leading-normal">
              Public repos require no token. If you hit GitHub's 60 req/hr limit, provide a read-only (fine-grained or classic "public_repo") token to unlock 5,000 req/hr.
            </p>
          </div>

          {/* Security Notice */}
          <div className="p-2.5 bg-blue-950/30 border border-blue-900/40 rounded-lg flex items-start gap-2 text-[11px] text-blue-300">
            <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Security guarantee:</strong> Your token is stored strictly in memory/session in your browser. It is NEVER exposed to the sandboxed execution iframe or sent to third parties.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            {token ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Token</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                {saved && <Check className="w-3.5 h-3.5" />}
                <span>{saved ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
