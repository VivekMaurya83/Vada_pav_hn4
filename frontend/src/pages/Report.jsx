import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Maximize2, CheckCircle2, Info, Search, FileCode2, Users, BookOpen, Zap, Github, GitBranch, ArrowRight, Loader2, X } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import IssueSelectionModal from '../components/remediation/IssueSelectionModal';
import RemediationWorkspace from '../components/remediation/RemediationWorkspace';
import FloatingChatbot from '../components/chatbot/FloatingChatbot';
import { useScanStore } from '../store/useScanStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function IssueCard({ issue, activeIssue, setActiveIssue, setSelectedImage }) {
  return (
    <div 
      onClick={() => setActiveIssue(activeIssue === issue.code ? null : issue.code)}
      className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
        activeIssue === issue.code 
        ? 'bg-slate-800 border-primary shadow-[0_0_20px_rgba(108,99,255,0.1)]' 
        : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            issue.severity === 'Critical' ? 'bg-red-500/10 text-red-500' :
            issue.severity === 'Serious' ? 'bg-orange-500/10 text-orange-500' : 'bg-yellow-500/10 text-yellow-600'
          }`}>
            {issue.severity === 'Critical' ? <ShieldAlert size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div>
            <h4 className="font-bold text-white tracking-wide">{issue.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-widest">{issue.pour_principle}</span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{issue.code}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
            issue.severity === 'Critical' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
            issue.severity === 'Serious' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
          }`}>
            {(issue.severity || 'Minor').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="pl-12 space-y-4">
        <p className="text-sm text-slate-200 leading-relaxed">{issue.description}</p>
        
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Affected Element</span>
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800/50 overflow-hidden group-hover:border-slate-800 transition-colors">
            <code className="text-[11px] text-secondary font-mono whitespace-pre-wrap break-all block">{issue.affected_element || issue.proof?.selector || "Site-wide / Multiple elements"}</code>
          </div>
        </div>

        <div className="pt-2 flex gap-12 border-t border-slate-800">
          <div>
            <div className="text-primary text-[9px] uppercase font-black mb-1 tracking-tighter">WCAG Mapping</div>
            <div className="text-white font-black text-sm">{issue.wcag_mapping || "N/A"}</div>
          </div>
          <div>
            <div className="text-secondary text-[9px] uppercase font-black mb-1 tracking-tighter">Impact Group</div>
            <div className="text-white font-black text-sm">{issue.disability_impact || "N/A"}</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function IssueDetailModal({ issue, onClose, setSelectedImage }) {
  if (!issue) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.95, opacity: 0, y: 20 }} 
          className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl space-y-8 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white bg-slate-200/50 hover:bg-red-500 rounded-full transition-all z-10 shadow-sm">
            <X size={20} />
          </button>
          
          <div>
            <h2 className="text-2xl font-extrabold text-white mb-3 pr-10">{issue.title}</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded uppercase tracking-widest border border-emerald-500/20">{issue.pour_principle}</span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded border border-slate-200">{issue.code}</span>
            </div>
          </div>
          
          {/* Detailed Content (Analysis Overview, Human Impact, etc.) */}
          <div className="border-l-4 border-primary pl-6 space-y-5 bg-primary/5 py-6 rounded-r-3xl">
            <h6 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary flex items-center gap-2">
              <Search size={14} /> I. Analysis Overview
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="text-primary text-[10px] uppercase font-black tracking-[0.2em]">Severity Reasoning</div>
                <p className="text-sm text-white/90 font-medium leading-relaxed">{issue.severity_justification}</p>
              </div>
              <div className="space-y-3">
                <div className="text-primary text-[10px] uppercase font-black tracking-[0.2em]">POUR Alignment</div>
                <p className="text-sm text-white/90 font-medium leading-relaxed">{issue.pour_justification}</p>
              </div>
            </div>
          </div>

          {/* Technical / Proof */}
          {issue.proof && (
            <div className="border-l-4 border-slate-400 pl-6 space-y-4">
              <h6 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                <Maximize2 size={14} /> II. Visual Evidence & Proof
              </h6>
              {issue.proof.element_screenshot && (
                <div 
                  className="rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 inline-block max-w-full cursor-zoom-in hover:border-primary transition-all p-4 shadow-sm"
                  onClick={() => { onClose(); setSelectedImage({ 
                    src: `data:image/png;base64,${issue.proof.element_screenshot}`, 
                    title: issue.title, 
                    selector: issue.proof.selector, 
                    description: issue.description 
                  }); }}
                >
                  <img src={`data:image/png;base64,${issue.proof.element_screenshot}`} alt="Proof" className="max-w-full h-auto max-h-[400px] object-contain rounded-lg" />
                </div>
              )}
              <code className="text-[12px] text-yellow-600 dark:text-yellow-300 font-mono bg-slate-100 dark:bg-black px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 block overflow-hidden whitespace-pre-wrap break-all shadow-inner">{issue.proof.selector}</code>
            </div>
          )}

          {/* Human Impact */}
          <div className="border-l-4 border-orange-500 pl-6 space-y-4">
            <h6 className="text-[11px] font-black uppercase tracking-[0.4em] text-orange-600 flex items-center gap-2">
              <Users size={14} /> III. Human Impact Dynamics
            </h6>
            <div className="bg-orange-500/5 p-6 rounded-3xl border border-orange-500/20 space-y-4 shadow-sm">
              <p className="text-white text-sm font-bold leading-relaxed">{issue.human_impact?.problem}</p>
              <p className="text-white/80 text-sm italic font-medium">"{issue.human_impact?.real_world_example}"</p>
            </div>
          </div>

          {/* Remediation */}
          <div className="border-l-4 border-emerald-500 pl-6 space-y-4">
            <h6 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary flex items-center gap-2">
              <Zap size={14} className="text-primary" /> IV. Remediation Strategy
            </h6>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 py-1 px-2 inline-block rounded">Failed Implementation</p>
                  <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 font-mono text-[11px] text-red-400 overflow-hidden whitespace-pre-wrap break-all shadow-inner">{issue.bad_code}</div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 py-1 px-2 inline-block rounded">Accessibility Standard</p>
                  <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 font-mono text-[11px] text-emerald-400 overflow-hidden whitespace-pre-wrap break-all shadow-inner">{issue.fixed_code}</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Report() {
  const { report, setUrl, startScan } = useScanStore();
  const [activeIssue, setActiveIssue] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [confirmAnalysis, setConfirmAnalysis] = useState(null); // {url, text}
  const [sortBy, setSortBy] = useState('severity'); // 'severity' or 'disability'
  
  // Remediation State
  const [isIssueSelectionOpen, setIsIssueSelectionOpen] = useState(false);
  const [isRemediationWorkspaceOpen, setIsRemediationWorkspaceOpen] = useState(false);
  const [selectedIssuesForRemediation, setSelectedIssuesForRemediation] = useState([]);
  const [githubRepoUrl, setGithubRepoUrl] = useState(() => localStorage.getItem('gh_repo_url') || '');
  const [githubBranch, setGithubBranch] = useState(() => localStorage.getItem('gh_repo_branch') || 'main');
  const [techStack, setTechStack] = useState(null);
  const [isAnalyzingRepo, setIsAnalyzingRepo] = useState(false);
  const { githubToken } = useAuthStore();

  const navigate = useNavigate();

  const handleAnalyticLink = (e, link) => {
    e.preventDefault();
    setConfirmAnalysis(link);
  };

  const triggerNewScan = async () => {
    if (!confirmAnalysis) return;
    const targetUrl = confirmAnalysis.href;
    setConfirmAnalysis(null);
    setUrl(targetUrl);
    navigate('/scan');
  };

  const analyzeRepo = async (url) => {
    if (!url || !githubToken) return;
    setIsAnalyzingRepo(true);
    try {
      const profile = await api.analyzeRepo(githubToken, url);
      setTechStack(profile);
    } catch (err) {
      console.error("Repo analysis failed", err);
    } finally {
      setIsAnalyzingRepo(false);
    }
  };

  // Auto-save URL & branch to localStorage whenever they change
  useEffect(() => {
    if (githubRepoUrl) localStorage.setItem('gh_repo_url', githubRepoUrl);
    else localStorage.removeItem('gh_repo_url');
    if (githubBranch) localStorage.setItem('gh_repo_branch', githubBranch);
  }, [githubRepoUrl, githubBranch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (githubRepoUrl && githubRepoUrl.includes('github.com')) {
        analyzeRepo(githubRepoUrl);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [githubRepoUrl, githubToken]);

  useEffect(() => {
    if (!report) {
      navigate('/scan');
    }
  }, [report, navigate]);

  useEffect(() => {
    if (selectedImage) {
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [selectedImage]);

  const handlePanStart = (e) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePanMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePanEnd = () => {
    setIsDragging(false);
  };

  if (!report) return null;

  const { overview, issues, final_summary, nav_links = [] } = report;

  // Grouping/Sorting Logic
  const getSortedIssues = () => {
    if (sortBy === 'severity') {
      const order = { Critical: 0, Serious: 1, Moderate: 2, Minor: 3 };
      return [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
    }
    
    // Group by disability
    const groups = {};
    issues.forEach(issue => {
      const impact = issue.disability_impact || 'General';
      if (!groups[impact]) groups[impact] = [];
      groups[impact].push(issue);
    });
    return groups;
  };

  const sortedData = getSortedIssues();

  return (
    <>
    <PageTransition>
      <div className="max-w-[1600px] mx-auto h-[calc(100vh-8rem)] flex flex-col font-sans relative">
        
        {/* Header shifted to Navbar */}

        {/* Main Section */}
        <div className="flex-1 flex justify-center w-full min-h-0">
          <div className="w-full max-w-5xl flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 pb-6 px-4">
            
            {/* Github Setup & Remediation Trigger */}
            <div className="bg-slate-800/30 border border-slate-800 p-6 rounded-3xl shrink-0 flex flex-col md:flex-row gap-6 items-center justify-between shadow-xl">
              <div className="flex-1 flex flex-col gap-3 w-full">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800"><Github size={18} className="text-white" /></div>
                  <h3 className="text-white font-bold text-lg">GitHub CI/CD Remediation Pipeline</h3>
                </div>
                <p className="text-slate-400 text-sm">Link your repository to push AI-remediated accessibility fixes directly via pull requests.</p>
                <div className="flex gap-3 mt-1">
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="https://github.com/username/repo" 
                      value={githubRepoUrl} 
                      onChange={e => setGithubRepoUrl(e.target.value)} 
                      className={`w-full bg-slate-900 border ${isAnalyzingRepo ? 'border-primary/50' : 'border-slate-800'} rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-all placeholder:text-slate-600 shadow-inner pr-10`} 
                    />
                    {isAnalyzingRepo && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="text-primary animate-spin" /></div>}
                    {githubRepoUrl && !isAnalyzingRepo && (
                      <button
                        onClick={() => { setGithubRepoUrl(''); localStorage.removeItem('gh_repo_url'); setTechStack(null); }}
                        title="Clear saved URL"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><GitBranch size={14} /></span>
                    <input type="text" placeholder="Branch" value={githubBranch} onChange={e => setGithubBranch(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors shadow-inner" />
                  </div>
                </div>
                {techStack && (
                  <div className="flex gap-2 items-center mt-1 scale-95 origin-left">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Stack:</span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold">{techStack.framework}</span>
                    <span className="px-2 py-0.5 bg-secondary/10 text-secondary border border-secondary/20 rounded text-[10px] font-bold">{techStack.language}</span>
                  </div>
                )}
              </div>
              <div className="shrink-0 w-full md:w-auto flex justify-end">
                <button onClick={() => setIsIssueSelectionOpen(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-slate-900 px-6 py-4 rounded-xl font-black transition-all shadow-[0_0_20px_rgba(108,99,255,0.15)] hover:shadow-[0_0_25px_rgba(108,99,255,0.3)] hover:-translate-y-0.5">
                  Start AI Remediation <ArrowRight size={18} />
                </button>
              </div>
            </div>

            {/* Top Row: Score & Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
              <div className="bg-slate-800/20 backdrop-blur-md border border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 blur-[50px] rounded-full"></div>
                <h3 className="text-slate-400 font-medium mb-6 w-full text-left">Overall Score</h3>
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle cx="80" cy="80" r="70" className="stroke-slate-700" strokeWidth="12" fill="none" />
                    <motion.circle 
                      cx="80" cy="80" r="70" className="stroke-primary drop-shadow-lg" strokeWidth="12" fill="none" strokeDasharray="439" 
                      initial={{ strokeDashoffset: 439 }}
                      animate={{ strokeDashoffset: 439 - (439 * (overview.pour_scores.overall / 100)) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeLinecap="round" 
                    />
                  </svg>
                  <div className="text-center mt-2">
                    <span className="text-5xl font-black text-white">{overview.pour_scores.overall}</span>
                    <span className="text-xl text-slate-500">/100</span>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-medium">
                  <span className="flex items-center gap-1.5 text-red-600 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20"><ShieldAlert size={16} /> {overview.severity_breakdown.Critical} Critical</span>
                  <span className="flex items-center gap-1.5 text-orange-600 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20"><AlertTriangle size={16} /> {overview.severity_breakdown.Serious} Serious</span>
                  <span className="flex items-center gap-1.5 text-yellow-600 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20"><Info size={16} /> {overview.severity_breakdown.Moderate + overview.severity_breakdown.Minor} Other</span>
                </div>
              </div>

              <div className="bg-slate-800/20 backdrop-blur-md border border-slate-800 p-6 rounded-3xl flex flex-col">
                <h3 className="text-slate-300 font-medium mb-6">POUR Principles Breakdown</h3>
                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  {['Perceivable', 'Operable', 'Understandable', 'Robust'].map((principle) => (
                    <div key={principle} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                        <span className="text-slate-400">{principle}</span>
                        <span className="text-primary">{overview.pour_scores[principle]}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <motion.div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${overview.pour_scores[principle]}%` }} transition={{ duration: 1, delay: 0.5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Issue Breakdown */}
            <div className="bg-slate-800/40 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shrink-0">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-xl font-bold text-white">Detected Violations ({issues.length})</h3>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button onClick={() => setSortBy('severity')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'severity' ? 'bg-primary text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>By Severity</button>
                  <button onClick={() => setSortBy('disability')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'disability' ? 'bg-primary text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>By Disability</button>
                </div>
              </div>

              <div className="space-y-4">
                {sortBy === 'severity' ? (
                  sortedData.map((issue, idx) => (
                    <IssueCard key={`${issue.code}-${idx}`} issue={issue} activeIssue={activeIssue} setActiveIssue={setActiveIssue} setSelectedImage={setSelectedImage} />
                  ))
                ) : (
                  Object.entries(sortedData).map(([impact, groupIssues]) => (
                    <div key={impact} className="space-y-4 mb-8">
                      <div className="flex items-center gap-2 px-2">
                        <div className="h-px flex-1 bg-slate-700/50"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full">{impact} Impact</span>
                        <div className="h-px flex-1 bg-slate-700/50"></div>
                      </div>
                      {groupIssues.map((issue, idx) => (
                        <IssueCard key={`${issue.code}-${idx}`} issue={issue} activeIssue={activeIssue} setActiveIssue={setActiveIssue} setSelectedImage={setSelectedImage} />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Navigation Discovery */}
            {nav_links.length > 0 && (
              <div className="bg-slate-800/20 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shrink-0">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-secondary/10 text-secondary rounded-lg"><Search size={20} /></div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Navigation Discovery</h3>
                    <p className="text-xs text-slate-400">Links identified during the accessibility crawl</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {nav_links.map((link, idx) => (
                    <button 
                      key={idx} 
                      onClick={(e) => handleAnalyticLink(e, link)}
                      className="group p-3 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-primary/50 transition-all flex items-center justify-between text-left"
                    >
                      <span className="text-xs text-slate-300 font-medium truncate pr-2 group-hover:text-primary transition-colors">{link.text}</span>
                      <Search size={12} className="text-slate-600 group-hover:text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Final Summary Card */}
            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2rem] text-center space-y-4 shrink-0">
               <h3 className="text-2xl font-bold text-white">Overall Rating: {final_summary.overall_rating}</h3>
               <div className="flex justify-center flex-wrap gap-2 text-xs">
                 {final_summary.priority_fixes.map((fix, i) => (
                   <span key={i} className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-800">Priority Fix: {fix}</span>
                 ))}
               </div>
            </div>

          </div>
        </div>
      </div>
      <FloatingChatbot />
    </PageTransition>

    <AnimatePresence>
      {confirmAnalysis && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
              <Search size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">Deep Analyze Link?</h3>
              <p className="text-slate-400 text-sm leading-relaxed">You are about to run a full accessibility audit on:<br/><span className="text-secondary font-mono break-all">{confirmAnalysis.href}</span></p>
            </div>
            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setConfirmAnalysis(null)} 
                className="flex-1 px-6 py-3 rounded-2xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-all border border-slate-800"
              >
                Cancel
              </button>
              <button 
                onClick={triggerNewScan} 
                className="flex-1 px-6 py-3 rounded-2xl bg-primary text-slate-900 font-black hover:opacity-90 shadow-[0_0_20px_rgba(108,99,255,0.3)] transition-all"
              >
                Analyze Now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {selectedImage && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-slate-900 border border-slate-800 p-2 rounded-2xl max-w-5xl w-full flex flex-col items-center h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex justify-between items-start px-4 py-4 border-b border-slate-800 shrink-0">
              <div className="flex-1 pr-6 overflow-hidden">
                <h3 className="text-white font-bold text-lg truncate">{selectedImage.title}</h3>
                <p className="text-xs text-secondary font-mono mt-1 truncate">Target: {selectedImage.selector}</p>
                {selectedImage.description && <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 mt-3"><p className="text-sm text-slate-300 leading-relaxed">{selectedImage.description}</p></div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex bg-slate-800 rounded-lg p-1 mr-2 border border-slate-700">
                  <button onClick={() => setZoomLevel(z => Math.max(z - 0.25, 0.5))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors" title="Zoom Out"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                  <div className="px-3 flex items-center justify-center text-xs font-mono text-slate-300 select-none min-w-[3.5rem]">{Math.round(zoomLevel * 100)}%</div>
                  <button onClick={() => setZoomLevel(z => Math.min(z + 0.25, 5))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors" title="Zoom In"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>
                  <div className="w-px h-4 bg-slate-700 mx-1 border-none self-center"></div>
                  <button onClick={() => { setZoomLevel(1); setPan({x:0, y:0}); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors" title="Reset Zoom"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg></button>
                </div>
                <button onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"><X size={20}/></button>
              </div>
            </div>
            
            <div 
              className={`flex-1 w-full overflow-hidden flex items-center justify-center p-6 bg-slate-950/50 rounded-b-2xl relative select-none ${zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
              onMouseDown={handlePanStart}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
            >
              <img 
                src={selectedImage.src} 
                alt="Enlarged preview" 
                style={{ 
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`, 
                  transformOrigin: 'center', 
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out' 
                }} 
                className="max-w-full max-h-full rounded-lg shadow-2xl object-contain pointer-events-none"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Remediation Modals */}
    {activeIssue && (
      <IssueDetailModal 
        issue={issues.find(i => i.code === activeIssue)} 
        onClose={() => setActiveIssue(null)} 
        setSelectedImage={setSelectedImage} 
      />
    )}
    <IssueSelectionModal 
      isOpen={isIssueSelectionOpen} 
      onClose={() => setIsIssueSelectionOpen(false)} 
      issues={issues} 
      onProceed={(selected) => {
        setSelectedIssuesForRemediation(selected);
        setIsIssueSelectionOpen(false);
        setIsRemediationWorkspaceOpen(true);
      }} 
    />
    <RemediationWorkspace 
      isOpen={isRemediationWorkspaceOpen} 
      onClose={() => setIsRemediationWorkspaceOpen(false)} 
      selectedIssues={selectedIssuesForRemediation} 
      repoUrl={githubRepoUrl}
      branch={githubBranch}
      techStack={techStack}
    />
  </>
  );
}

