import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  X, Send, Bot, User, Code2, Play, CheckCircle2, 
  GitPullRequest, AlertCircle, FileCode2, Copy, 
  RefreshCcw, Settings, TerminalSquare, ExternalLink, Loader2
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function RemediationWorkspace({ isOpen, onClose, selectedIssues, repoUrl, branch, techStack }) {
  const { githubToken } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [isGitHubActionLoading, setIsGitHubActionLoading] = useState(false);
  
  const [files, setFiles] = useState([]); // [{path, content, originalContent, status}]
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState('original'); // 'original' | 'modified'
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with mapping logic when issues are selected
  useEffect(() => {
    if (isOpen && selectedIssues && selectedIssues.length > 0) {
      const issueDetails = selectedIssues.map(i => `- **${i.title}** (${i.code})`).join('\n');
      setMessages([
        { 
          role: 'assistant', 
          content: `Workspace ready. I'm currently mapping the issues to your source code repository...`
        }
      ]);
      
      const performMapping = async () => {
        setIsMapping(true);
        const mappedFiles = [];
        const seenPaths = new Set();

        console.group('🔍 [AccessiScan] Source Mapping Started');
        console.log('📦 TechStack:', techStack);
        console.log('🔗 Repo URL:', repoUrl);
        console.log('🐛 GitHub Token present:', !!githubToken);
        console.log(`📋 Issues to map (${selectedIssues.length}):`, selectedIssues.map(i => i.code));
        console.groupEnd();

        for (const issue of selectedIssues) {
          const snippet = issue.bad_code || issue.proof?.html_snippet;
          
          console.group(`🔎 Mapping issue: ${issue.code} — ${issue.title}`);
          console.log('Has snippet:', !!snippet);
          if (snippet) console.log('Snippet (first 300):', snippet.substring(0, 300));
          
          if (repoUrl && githubToken && snippet) {
            try {
              console.log('📡 Calling /github/search-code...');
              const result = await api.searchCode(
                githubToken, 
                repoUrl, 
                issue.code, 
                snippet
              );
              
              console.log(`✅ Search result for ${issue.code}:`, result);
              console.log('  → debug info:', result.debug);
              
              if (result.matches && result.matches.length > 0) {
                console.table(result.matches.map(m => ({
                  file: m.file_path,
                  score: m.score,
                  strategy: m.strategy,
                  matchTerm: m.match_term,
                  contentLen: m.content?.length
                })));
                
                for (const match of result.matches) {
                  if (!seenPaths.has(match.file_path)) {
                    mappedFiles.push({
                      path: match.file_path,
                      content: match.content,
                      originalContent: match.content,
                      status: 'mapped',
                      issueCode: issue.code,
                      score: match.score,
                      strategy: match.strategy
                    });
                    seenPaths.add(match.file_path);
                    console.log(`  ✅ Added file: ${match.file_path} (score: ${match.score})`);
                  } else {
                    console.log(`  ⏭️ Skipping duplicate: ${match.file_path}`);
                  }
                }
              } else {
                console.warn(`  ❌ No matches found. Debug:`, result.debug);
              }
            } catch (err) {
              console.error(`  💥 Mapping failed for ${issue.code}:`, err);
            }
          } else {
            console.warn('  ⚠️ Skipping search — missing repoUrl, token, or code snippet.');
            console.log('    repoUrl:', repoUrl);
            console.log('    token:', !!githubToken);
            console.log('    snippet:', snippet);
          }
          console.groupEnd();
        }

        console.group('📊 [AccessiScan] Mapping Summary');
        console.log(`Mapped ${mappedFiles.length} files from ${selectedIssues.length} issues`);
        if (mappedFiles.length > 0) {
          console.table(mappedFiles.map(f => ({ path: f.path, issueCode: f.issueCode, score: f.score })));
        }
        console.groupEnd();

        // Fallback for demo/simple cases if no files found
        if (mappedFiles.length === 0) {
          console.warn('⚠️ Mapping failed for all issues. Using fallback (DOM snippet only).');
          mappedFiles.push({
            path: 'App.jsx',
            content: `// Source file mapping failed. Using generic component context.\n\n${selectedIssues[0].bad_code || '/* Element Source */'}`,
            originalContent: selectedIssues[0].bad_code,
            status: 'fallback'
          });
        }

        setFiles(mappedFiles);
        setIsMapping(false);
        setMessages(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: `Mapping complete! I've identified **${mappedFiles.length}** relevant source files in your **${techStack?.framework || 'React'}** repository. I'm ready to generate framework-native fixes (using **${techStack?.language || 'TypeScript/JSX'}**).`
          }
        ]);
      };

      performMapping();
    }
  }, [isOpen, selectedIssues, repoUrl, githubToken, techStack]);

  if (!isOpen) return null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userText = inputMessage;
    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const chatHistory = newMessages.map(m => ({ role: m.role, content: m.content }));
      const activeFile = files[activeFileIndex] || {};
      const response = await api.remediate(
        selectedIssues, 
        userText, 
        chatHistory,
        {
          techStack: techStack,
          currentFile: activeFile.path,
          sourceCode: activeFile.content
        }
      );
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.content 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your request. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!githubToken || !repoUrl) {
      alert("Please configure GitHub token and repository URL first.");
      return;
    }
    setIsGitHubActionLoading(true);
    try {
      const title = `Accessibility Remediation: Fix ${selectedIssues.length} issues`;
      const body = `### Summary\nThis issue tracks accessibility fixes for the following:\n\n${selectedIssues.map(i => `- ${i.title} (${i.code})`).join('\n')}\n\n---\n*Report generated by AccessiScan AI*`;
      
      const res = await api.createGithubIssue(githubToken, repoUrl, title, body);
      if (res.html_url) {
        window.open(res.html_url, '_blank text');
      }
    } catch (err) {
      alert("Failed to create GitHub issue: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsGitHubActionLoading(false);
    }
  };

  const patchCode = (source, patchContent) => {
    if (!patchContent || !source) return source;
    console.log('[PATCH] Attempting to patch source using AI message...');

    let updatedSource = source;
    let totalPatched = 0;

    const normLines = (text) =>
      text.split('\n').map(l => l.trim()).filter(Boolean).join('\n');

    const buildLineRegex = (snippet) => {
      const lines = snippet.split('\n').filter(l => l.trim());
      if (lines.length === 0) return null;
      const pattern = lines
        .map(l => `[^\\S\\r\\n]*${l.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\S\\r\\n]*`)
        .join('\\r?\\n');
      try { return new RegExp(pattern); } catch { return null; }
    };

    const applyPatch = (src, beforeRaw, afterRaw) => {
      try {
        const before = beforeRaw.trim();
        const after = afterRaw.trim();

        // Skip degenerate BEFORE blocks (comment-only or empty)
        if (!before || (before.startsWith('//') && !before.includes('\n'))) {
          return { result: src, applied: false };
        }

        // S1: Exact match
        if (src.includes(before)) {
          console.log('[PATCH] ✅ S1 exact');
          // Use callback to prevent '$' characters in 'after' from being interpreted as regex patterns
          return { result: src.replace(before, () => after), applied: true };
        }

        // S2: Line-normalized — ignores indentation
        const rx2 = buildLineRegex(before);
        if (rx2 && rx2.test(src)) {
          console.log('[PATCH] ✅ S2 line-normalized');
          return { result: src.replace(rx2, () => after), applied: true };
        }

        // S2b: Flex-line match — each BEFORE line allowed to have extra trailing content
        const rx2b = buildFlexLineRegex(before);
        if (rx2b && rx2b.test(src)) {
          console.log('[PATCH] ✅ S2b flex-line');
          return { result: src.replace(rx2b, () => after), applied: true };
        }

        // S3: Already-applied check
        const afterNorm = normLines(after);
        const srcNorm = normLines(src);
        if (afterNorm && srcNorm.includes(afterNorm)) {
          console.log('[PATCH] ✅ S3 already applied — no-op');
          return { result: src, applied: true };
        }

        // S4: Attribute/diff-level
        const bLines = before.split('\n').map(l => l.trim()).filter(Boolean);
        const aLines = after.split('\n').map(l => l.trim()).filter(Boolean);
        const added = aLines.filter(l => !bLines.some(b => b === l));
        const removed = bLines.filter(l => !aLines.some(a => a === l));

        let s4Src = src;
        let s4Applied = 0;

        for (const rem of removed) {
          const addedAlready = added.every(a => {
            const rx = buildLineRegex(a);
            return rx && rx.test(s4Src);
          });
          if (addedAlready) continue;

          const rx = buildLineRegex(rem);
          if (rx && rx.test(s4Src)) {
            const idx = removed.indexOf(rem);
            const addLine = added[idx] ?? added[0];
            if (addLine) {
              s4Src = s4Src.replace(rx, (m) => m.replace(rem.trim(), () => addLine.trim()));
              s4Applied++;
            }
          }
        }

        if (s4Applied > 0) {
          console.log('[PATCH] ✅ S4 diff-level applied');
          return { result: s4Src, applied: true };
        }

        // S5: Pure insertion
        if (added.length > 0 && removed.length === 0) {
          const lastBeforeLine = bLines[bLines.length - 1];
          if (lastBeforeLine) {
            const anchorRx = buildFlexLineRegex(lastBeforeLine);
            if (anchorRx && anchorRx.test(src)) {
              const newLines = added.join('\n');
              console.log('[PATCH] ✅ S5 pure insertion after anchor line');
              return {
                result: src.replace(anchorRx, (m) => `${m}\n${newLines}`),
                applied: true
              };
            }
          }
        }

        // S6: "Super Fuzzy" Match & Replace
        const superFuzzy = (t) => t.replace(/[;,\s\r\n]+/g, '');
        const sfB = superFuzzy(before);
        const sfS = superFuzzy(src);
        if (sfB && sfS.includes(sfB)) {
          if (before.length < 500) {
            const pattern = before.trim().split('').map(c => {
              if (/[;,\s\r\n]/.test(c)) return '[;,\\s\\r\\n]*';
              return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[;,\\s\\r\\n]*';
            }).join('');
            try {
              const rx6 = new RegExp(pattern);
              if (rx6.test(src)) {
                console.log('[PATCH] ✅ S6 super-fuzzy match applied');
                return { result: src.replace(rx6, () => after), applied: true };
              }
            } catch (e) {}
          }
        }

        console.error('[PATCH] ❌ All strategies failed:', before.substring(0, 80));
        return { result: src, applied: false };
      } catch (err) {
        console.error('[PATCH] 💥 Error in applyPatch:', err);
        return { result: src, applied: false };
      }
    };

    // Extract all code blocks from the AI message
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    let codeBlock;
    while ((codeBlock = codeBlockRegex.exec(patchContent)) !== null) {
      let blockContent = codeBlock[1];
      
      // Pre-process: Strip accidental markers from blocks that don't follow the full pair format
      // This prevents the patcher from trying to match the string "--- BEFORE ---" in the source code
      const hasFullPair = blockContent.includes('BEFORE') && blockContent.includes('AFTER');
      if (!hasFullPair) {
        blockContent = blockContent.replace(/(?:\/\/|\/\*)\s*---\s*(?:BEFORE|AFTER)[^\n]*\r?\n?/g, '');
      }

      const pairRegex = /(?:\/\/|\/\*)\s*---\s*BEFORE[^\n]*\n([\s\S]*?)\n\s*(?:\/\/|\/\*)\s*---\s*AFTER[^\n]*\n([\s\S]*?)(?=\n\s*(?:\/\/|\/\*)\s*---|$)/g;
      let pair;
      let blockApplied = false;
      while ((pair = pairRegex.exec(blockContent)) !== null) {
        const { result, applied } = applyPatch(updatedSource, pair[1], pair[2]);
        if (applied) { updatedSource = result; totalPatched++; blockApplied = true; }
      }

      // S7: Bookend Match for markerless blocks (if no BEFORE/AFTER pairs found)
      if (!blockApplied && blockContent.trim().length > 20) {
        try {
          const lines = blockContent.split('\n').filter(l => l.trim());
          if (lines.length >= 2) {
            const firstLine = lines[0];
            const lastLine = lines[lines.length - 1];
            // Even fuzzier regex for the bookends
            const buildBookendRx = (l) => {
              const norm = l.trim().replace(/[{}()[\];,\s]+$/, '').trim(); // strip braces/parens/separators
              if (norm.length < 3) return null;
              const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return new RegExp(`[^\\S\\r\\n]*${escaped}[^\\r\\n]*`, 'g');
            };

            const fRx = buildBookendRx(firstLine);
            const lRx = buildBookendRx(lastLine);
            
            if (fRx && lRx) {
              const fMatches = [...updatedSource.matchAll(fRx)];
              const lMatches = [...updatedSource.matchAll(lRx)];
              
              // Find the pair (f, l) that has the smallest distance and is most likely the target
              let bestPair = null;
              let minDistance = Infinity;
              
              for (const f of fMatches) {
                for (const l of lMatches) {
                  const distance = l.index - f.index;
                  // The range should be reasonably close to the snippet's length
                  if (distance > 0 && distance < blockContent.length * 2.5 && distance < minDistance) {
                    minDistance = distance;
                    bestPair = { f, l };
                  }
                }
              }

              if (bestPair) {
                console.log('[PATCH] ✅ S7 refined bookend match applied');
                updatedSource = 
                  updatedSource.substring(0, bestPair.f.index) + 
                  blockContent + 
                  updatedSource.substring(bestPair.l.index + bestPair.l[0].length);
                totalPatched++;
                blockApplied = true;
              }
            }
          }
        } catch (err) {
          console.error('[PATCH] 💥 Error in S7 bookend match:', err);
        }
      }

      // S8: Anchor-Line fallback — Match by first unique-ish line and replace subsequent block
      if (!blockApplied && blockContent.trim().length > 40) {
        try {
          const blockLines = blockContent.split('\n').filter(l => l.trim());
          if (blockLines.length > 3) {
            // Find a line that looks unique (long enough, not just braces)
            const anchorLine = blockLines.find(l => l.trim().length > 25) || blockLines[0];
            const anchorRx = buildFlexLineRegex(anchorLine);
            if (anchorRx) {
              const matches = [...updatedSource.matchAll(new RegExp(anchorRx.source, 'g'))];
              if (matches.length === 1) {
                const match = matches[0];
                console.log('[PATCH] ✅ S8 unique anchor match applied');
                // We'll replace a range of similar length to the block Content
                // starting from a reasonable point before the anchor (if anchor isn't the first line)
                const anchorInBlockIdx = blockContent.indexOf(anchorLine);
                const startIdx = Math.max(0, match.index - anchorInBlockIdx);
                // Try to find the end by matching the last line of the block near the expected end position
                const expectedEndIdx = startIdx + blockContent.length;
                const lastLine = blockLines[blockLines.length - 1];
                const lastRx = buildFlexLineRegex(lastLine);
                let endIdx = expectedEndIdx;
                
                if (lastRx) {
                  const endMatches = [...updatedSource.matchAll(new RegExp(lastRx.source, 'g'))];
                  const bestEnd = endMatches.find(m => Math.abs(m.index - expectedEndIdx) < 100);
                  if (bestEnd) endIdx = bestEnd.index + bestEnd[0].length;
                }

                updatedSource = 
                  updatedSource.substring(0, startIdx) + 
                  blockContent + 
                  updatedSource.substring(endIdx);
                totalPatched++;
                blockApplied = true;
              }
            }
          }
        } catch (err) {
          console.error('[PATCH] 💥 Error in S8 anchor match:', err);
        }
      }

      // S9: Structural Full Replacer Fallback
      // If a markerless block is large (>70% of source) and contains structural code (imports/exports),
      // we assume it's a "Re-written" version of the file being offered by the AI.
      if (!blockApplied && blockContent.trim().length > 100) {
        const structuralKeywords = ['import ', 'export ', 'function ', 'class ', 'const ', 'let '];
        const hasStructure = structuralKeywords.some(k => blockContent.includes(k));
        if (hasStructure) {
          const srcLinesOrig = updatedSource.split('\n').length;
          const blockLines = blockContent.split('\n').length;
          if (blockLines > srcLinesOrig * 0.6) {
             console.log('[PATCH] ✅ S9 structural full file replacement applied');
             updatedSource = blockContent;
             totalPatched++;
             blockApplied = true;
          }
        }
      }
    }

    console.log(`[PATCH] Done. ${totalPatched} patch(es) applied.`);
    return updatedSource;
  };

  const handleCreatePR = async () => {
    if (!githubToken || !repoUrl) {
      alert("Please configure GitHub token and repository URL first.");
      return;
    }

    // Only include files that were actually patched (have a green MODIFIED badge)
    const modifiedFiles = files.filter(f => f.content && f.originalContent && f.content !== f.originalContent);
    if (modifiedFiles.length === 0) {
      alert("No modified files found! Please apply at least one fix first (green MODIFIED badge).");
      return;
    }

    setIsGitHubActionLoading(true);
    try {
      const title = "Remediate: AI-Powered Accessibility Fixes";
      const body = "This PR applies accessibility fixes generated by AccessiScan AI.\n\n" + 
                   `**Modified Files:** ${modifiedFiles.map(f => f.path.split('/').pop()).join(', ')}\n\n` +
                   selectedIssues.map(i => `#### ${i.title}\n- WCAG: ${i.wcag_mapping}\n- Impact: ${i.disability_impact}`).join('\n\n');
      
      const changes = modifiedFiles.map(f => ({ path: f.path, content: f.content }));
      console.log(`[PR] Sending ${changes.length} modified file(s):`, changes.map(c => c.path));
      const res = await api.createGithubPR(githubToken, repoUrl, branch, title, body, changes);
      
      if (res.html_url) {
        window.open(res.html_url, '_blank');
      }
    } catch (err) {
      alert("Failed to create Pull Request: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsGitHubActionLoading(false);
    }
  };

  const applyToEditor = (patchMessage) => {
    try {
      // Attempt to detect target file from message
      let targetIndex = activeFileIndex;
      const filePatterns = [/Fix for ([\w./-]+)/i, /Update ([\w./-]+)/i, /\/\/ File: ([\w./-]+)/i];
      for (const pattern of filePatterns) {
        const match = patchMessage.match(pattern);
        if (match) {
          const foundIndex = files.findIndex(f => f.path.includes(match[1]));
          if (foundIndex !== -1) {
            targetIndex = foundIndex;
            break;
          }
        }
      }

      setFiles(prev => {
        try {
          const next = [...prev];
          const file = next[targetIndex];
          if (file) {
            setActiveFileIndex(targetIndex); // Switch view to patched file
            const baseContent = file.content || file.originalContent;
            const patched = patchCode(baseContent, patchMessage);
            
            if (patched === baseContent && patchMessage.includes('BEFORE')) {
              console.error("Patching failed - no match found.");
            }
            
            file.content = patched;
          }
          return next;
        } catch (innerErr) {
          console.error('[PATCH] Error updating files state:', innerErr);
          return prev;
        }
      });
      setViewMode('modified');
    } catch (err) {
      console.error('[PATCH] Fatal error in applyToEditor:', err);
      alert("A critical error occurred while applying the fix. The operation was aborted to prevent a component crash.");
    }
  };

  const detectFile = (message) => {
    if (!message) return activeFile.path.split('/').pop();
    const patterns = [/Fix for ([\w./-]+)/i, /Update ([\w./-]+)/i, /\/\/ File: ([\w./-]+)/i];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const file = files.find(f => f.path.includes(match[1]));
        if (file) return file.path.split('/').pop();
      }
    }
    return activeFile.path.split('/').pop();
  };

  const activeFile = files[activeFileIndex] || { path: 'Loading...', content: '' };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 z-[120] bg-slate-950 flex flex-col font-sans"
      >
        {/* Header (Top Navbar) */}
        <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-slate-900 rounded-lg flex items-center justify-center font-bold">
                <Bot size={18} />
              </div>
              <div>
                <h1 className="text-white font-bold text-sm leading-tight">AI Remediation</h1>
                <p className="text-[10px] text-slate-400 font-mono">{selectedIssues?.length || 0} Issues Loaded</p>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800 mx-2"></div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Target Repository</span>
              <span className="text-[11px] text-primary font-mono">{repoUrl || 'No Repo Linked'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleCreateIssue}
              disabled={isGitHubActionLoading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-600 transition-colors disabled:opacity-50"
            >
              <AlertCircle size={14} /> Create Issue
            </button>
            <button 
              onClick={handleCreatePR}
              disabled={isGitHubActionLoading}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors shadow-[0_0_15px_rgba(108,99,255,0.2)] disabled:opacity-50"
            >
              {isGitHubActionLoading ? <Loader2 size={14} className="animate-spin" /> : <GitPullRequest size={14} />} 
              Review & Create PR
            </button>
            <div className="h-6 w-px bg-slate-800 mx-1"></div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Content Split */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Pane: Chat */}
          <div className="w-[45%] min-w-0 flex flex-col border-r border-slate-800 bg-slate-950/50">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    msg.role === 'user' ? 'bg-slate-800 text-slate-300' : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  
                  <div className={`flex flex-col gap-2 max-w-[90%] min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words overflow-hidden w-full ${
                      msg.role === 'user' 
                      ? 'bg-primary text-slate-900 font-medium rounded-tr-sm' 
                      : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-sm shadow-xl'
                    }`}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p({ children }) {
                            return <div className="mb-2 last:mb-0 text-sm leading-relaxed">{children}</div>;
                          },
                          code({node, inline, className, children, ...props}) {
                            const isBlock = !inline && (String(children).includes('\n') || /language-/.test(className || ''));
                            return isBlock ? (
                              <pre className="bg-zinc-950 p-4 rounded-xl border border-white/5 font-mono text-xs overflow-x-auto my-2 whitespace-pre">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            ) : (
                              <code className="bg-slate-700/60 px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs inline" style={{display:'inline'}} {...props}>
                                {children}
                              </code>
                            )
                          },
                          strong({ children }) {
                            return <strong className="text-white font-bold">{children}</strong>;
                          },
                          li({ children }) {
                            return <li className="ml-4 mb-1 list-disc text-sm">{children}</li>;
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {/* Apply Fixes button — at the message level so it passes the full message to patchCode */}
                    {/* Apply Fixes button — Show if message contains code OR markers */}
                    {msg.role === 'assistant' && (msg.content.includes('BEFORE') || msg.content.includes('```')) && (
                      <button 
                        onClick={() => applyToEditor(msg.content)}
                        className="self-start flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-500/30 transition-all"
                      >
                        <CheckCircle2 size={11} /> Apply Fix to {detectFile(msg.content)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                    <Bot size={14} />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
              <form onSubmit={handleSendMessage} className="relative">
                <textarea 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask for fixes, explanations, or code logic..."
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-4 pr-14 py-3 text-sm resize-none h-[80px] focus:outline-none focus:border-primary transition-all placeholder:text-slate-600"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute bottom-3 right-3 p-2 bg-primary text-slate-900 rounded-lg hover:opacity-90 disabled:bg-slate-800 transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>

          {/* Right Pane: Dual-view Code Editor */}
          <div className="w-[55%] min-w-0 flex flex-col bg-[#1e1e2e]">
            
            {/* View Mode Switcher */}
            <div className="flex items-center gap-0 px-4 py-2 bg-[#11111b] border-b border-[#313244] shrink-0">
              <div className="flex items-center bg-[#1e1e2e] rounded-lg p-1 border border-[#313244]">
                <button
                  onClick={() => setViewMode('original')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                    viewMode === 'original'
                      ? 'bg-slate-600 text-white shadow'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <FileCode2 size={13} /> Original
                </button>
                <button
                  onClick={() => setViewMode('modified')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                    viewMode === 'modified'
                      ? 'bg-primary text-slate-900 shadow'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <CheckCircle2 size={13} /> Modified
                  {files.some(f => f.content !== f.originalContent) && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  )}
                </button>
              </div>
              <span className="ml-3 text-[10px] text-slate-500 font-mono">
                {viewMode === 'original' ? 'Source fetched from GitHub' : 'AI-patched version — click Apply Fix to populate'}
              </span>
            </div>

            {/* File Tabs */}
            <div className="flex items-center justify-between px-2 py-1 bg-[#11111b] border-b border-[#313244] shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex gap-0">
                {files.map((file, idx) => (
                  <button
                   key={idx}
                   onClick={() => setActiveFileIndex(idx)}
                   className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono transition-all border-b-2 whitespace-nowrap ${
                     activeFileIndex === idx
                     ? 'bg-[#181825] border-primary text-white'
                     : 'border-transparent text-[#6c7086] hover:bg-[#181825] hover:text-[#cdd6f4]'
                   }`}
                  >
                    <FileCode2 size={12} className={file.status === 'mapped' ? 'text-primary' : 'text-slate-600'} />
                    {file.path.split('/').pop()}
                    {file.content !== file.originalContent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Modified" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 shrink-0 ml-2">
                <button onClick={handleCreatePR} className="flex text-[10px] font-black uppercase text-white bg-primary px-3 py-1 rounded shadow shadow-primary/20 hover:opacity-90 items-center gap-1">
                  <CheckCircle2 size={11} /> Approve All
                </button>
              </div>
            </div>

            {/* Code View */}
            <div className="flex-1 overflow-auto bg-[#1e1e2e]">
              {files.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                  {isMapping ? 'Mapping source files...' : 'No files mapped yet.'}
                </div>
              ) : (
                <div className="relative">
                  {/* File path breadcrumb */}
                  <div className="sticky top-0 z-10 px-4 py-1.5 bg-[#181825] border-b border-[#313244] flex items-center gap-2">
                    <span className="text-[10px] text-primary font-mono">{files[activeFileIndex]?.path}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      viewMode === 'modified' && files[activeFileIndex]?.content !== files[activeFileIndex]?.originalContent
                        ? 'bg-green-500/20 text-green-400 border border-green-400/20'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {viewMode === 'original' ? 'ORIGINAL' : 
                        files[activeFileIndex]?.content !== files[activeFileIndex]?.originalContent ? 'MODIFIED ✓' : 'NOT YET MODIFIED'}
                    </span>
                  </div>
                  <pre className="p-4 text-[12px] font-mono text-[#cdd6f4] leading-5 overflow-x-auto whitespace-pre">
                    {viewMode === 'original'
                      ? (files[activeFileIndex]?.originalContent || '')
                      : (files[activeFileIndex]?.content || '')}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
