import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, User, Users, MousePointer2, ChevronRight, Check } from 'lucide-react';

export default function IssueSelectionModal({ isOpen, onClose, issues, onProceed }) {
  const [selectedIssues, setSelectedIssues] = useState(new Set());

  if (!isOpen) return null;

  // Group issues by disability impact
  const groups = {};
  issues.forEach(issue => {
    const impact = issue.disability_impact || 'General';
    if (!groups[impact]) groups[impact] = [];
    groups[impact].push(issue);
  });

  const toggleIssue = (code) => {
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedIssues(newSelected);
  };

  const toggleGroup = (impactGroup, groupIssues) => {
    const newSelected = new Set(selectedIssues);
    const allSelected = groupIssues.every(issue => selectedIssues.has(issue.code));
    
    groupIssues.forEach(issue => {
      if (allSelected) {
        newSelected.delete(issue.code);
      } else {
        newSelected.add(issue.code);
      }
    });
    
    setSelectedIssues(newSelected);
  };

  const handleProceed = () => {
    const selected = issues.filter(issue => selectedIssues.has(issue.code));
    onProceed(selected);
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.95, opacity: 0, y: 20 }} 
          className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Users className="text-primary" />
                Smart AI Remediation
              </h2>
              <p className="text-slate-400 text-sm mt-1">Select issues to send to the AI Remediation Workspace</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-900">
            {Object.entries(groups).map(([impact, groupIssues]) => {
              const allSelected = groupIssues.every(issue => selectedIssues.has(issue.code));
              const someSelected = groupIssues.some(issue => selectedIssues.has(issue.code));
              
              return (
                <div key={impact} className="space-y-4">
                  <div className="flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm p-2 z-10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <User size={16} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-200 capitalize">{impact} Impact</h3>
                      <span className="text-xs font-medium bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{groupIssues.length} issues</span>
                    </div>
                    <button 
                      onClick={() => toggleGroup(impact, groupIssues)}
                      className={`text-sm px-4 py-1.5 rounded-lg border transition-all ${allSelected ? 'bg-primary/10 text-primary border-primary/30' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                    >
                      {allSelected ? 'Deselect Group' : 'Select Group'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupIssues.map(issue => {
                      const isSelected = selectedIssues.has(issue.code);
                      return (
                        <div 
                          key={issue.code}
                          onClick={() => toggleIssue(issue.code)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex gap-4 ${isSelected ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(108,99,255,0.1)]' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                        >
                          <div className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center shrink-0 transition-colors border ${isSelected ? 'bg-primary border-primary text-slate-900' : 'bg-slate-800 border-slate-700 text-transparent'}`}>
                            <Check size={14} className="stroke-[3px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-200 text-sm truncate">{issue.title}</h4>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{issue.description}</p>
                            <div className="mt-3 flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                                issue.severity === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                issue.severity === 'Serious' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              }`}>
                                {issue.severity?.toUpperCase()}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{issue.code}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="text-slate-400 text-sm">
              <span className="text-white font-bold">{selectedIssues.size}</span> issues selected for AI remediation
            </div>
            <button 
              disabled={selectedIssues.size === 0}
              onClick={handleProceed}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                selectedIssues.size > 0 
                ? 'bg-primary text-slate-900 hover:opacity-90 hover:scale-[1.02] shadow-[0_0_20px_rgba(108,99,255,0.3)]' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Continue to AI Workspace <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
