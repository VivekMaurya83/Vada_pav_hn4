import React, { useState } from 'react';
import PageTransition from '../components/layout/PageTransition';
import { useAuthStore } from '../store/useAuthStore';
import { ShieldCheck, ShieldX, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export default function Settings() {
  const { githubToken, setGithubToken, gitHubStatus, setGitHubStatus, clearGithubToken } = useAuthStore();
  const [tokenInput, setTokenInput] = useState(githubToken || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateToken = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setLoading(true);
    setError('');
    setGitHubStatus('validating');

    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenInput}`,
        },
      });

      if (response.status === 200) {
        setGithubToken(tokenInput);
        setGitHubStatus('valid');
      }
    } catch (err) {
      console.error('Token validation failed:', err);
      setGitHubStatus('invalid');
      if (err.response?.status === 401) {
        setError('Invalid token. Please check the permissions and try again.');
      } else {
        setError('Validation failed. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    clearGithubToken();
    setTokenInput('');
    setError('');
  };

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>
        
        <div className="bg-slate-800/40 backdrop-blur-md p-8 rounded-[2rem] border border-slate-700/50 space-y-8 shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-slate-200 text-sm font-bold mb-1">GitHub Fine-grained Token</label>
                <p className="text-xs text-slate-500">Enable direct PR and issue creation from reports.</p>
              </div>
              
              {gitHubStatus === 'valid' && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] font-black text-green-500 uppercase tracking-widest">
                  <ShieldCheck size={14} /> Verified
                </div>
              )}
              {gitHubStatus === 'invalid' && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-black text-red-500 uppercase tracking-widest">
                  <ShieldX size={14} /> Invalid
                </div>
              )}
            </div>

            <form onSubmit={validateToken} className="space-y-4">
              <div className="relative group">
                <input 
                  type="password" 
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxx" 
                  className={`w-full bg-slate-900/80 border ${gitHubStatus === 'invalid' ? 'border-red-500/50' : 'border-slate-700'} rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all pr-12`}
                />
                {gitHubStatus === 'valid' && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
                    <CheckCircle2 size={20} />
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-400 font-medium px-1">{error}</p>}

              <div className="flex gap-3">
                <button 
                  type="submit"
                  disabled={loading || !tokenInput || (tokenInput === githubToken && gitHubStatus === 'valid')}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-black px-6 py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(108,99,255,0.2)] flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Validate & Save'}
                </button>
                
                {githubToken && (
                  <button 
                    type="button"
                    onClick={handleClear}
                    className="aspect-square bg-slate-800 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-500 p-4 rounded-2xl transition-all"
                    title="Clear Token"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-700/50">
            <h4 className="text-white font-bold text-sm mb-3">Security Information</h4>
            <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
              <li>Your token is stored locally in your browser and never sent to our servers.</li>
              <li>Required permissions: <code className="bg-slate-900 px-1 rounded text-secondary">Metadata</code>, <code className="bg-slate-900 px-1 rounded text-secondary">Issues</code>, and <code className="bg-slate-900 px-1 rounded text-secondary">Pull Requests</code>.</li>
              <li>You can revoke this token at any time in your GitHub Settings.</li>
            </ul>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
