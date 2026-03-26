import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FileBarChart, Clock, ShieldAlert, ArrowRight, CheckCircle2, TrendingUp } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { useScanStore } from '../store/useScanStore';

export default function Reports() {
  const navigate = useNavigate();
  const { history, fetchHistory } = useScanStore();
  const [filterUrl, setFilterUrl] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  const getHost = (urlString) => {
    try {
      return new URL(urlString).host;
    } catch (e) {
      return urlString;
    }
  };

  const uniqueHosts = [...new Set(history.map(h => getHost(h.url)))];

  const displayedHistory = history
    .filter(h => filterUrl === 'All' || getHost(h.url) === filterUrl)
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.timestamp) - new Date(a.timestamp);
      if (sortBy === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp);
      if (sortBy === 'score_high') return b.score - a.score;
      if (sortBy === 'score_low') return a.score - b.score;
      return 0;
    });

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
  };

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-8 font-sans">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Scan Reports</h1>
            <p className="text-slate-400">View and manage all historical accessibility audits.</p>
          </div>
          <button 
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg"
          >
            <TrendingUp size={18} />
            Analytics Dashboard
          </button>
        </div>

        {/* Controls */}
        {history.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10">
            <div className="flex-1 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <select 
                  value={filterUrl} 
                  onChange={(e) => setFilterUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/50 hover:border-primary/30 text-zinc-300 hover:text-white rounded-xl pl-4 pr-10 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer appearance-none shadow-lg font-medium truncate"
                >
                  <option value="All" className="bg-zinc-900 text-zinc-300">All Websites / Projects</option>
                  {uniqueHosts.map(host => <option key={host} value={host} className="bg-zinc-900 text-zinc-300">{host}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              
              <div className="relative w-full sm:w-48">
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/50 hover:border-primary/30 text-zinc-300 hover:text-white rounded-xl pl-4 pr-10 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer appearance-none shadow-lg font-medium"
                >
                  <option value="newest" className="bg-zinc-900 text-zinc-300">Newest First</option>
                  <option value="oldest" className="bg-zinc-900 text-zinc-300">Oldest First</option>
                  <option value="score_high" className="bg-zinc-900 text-zinc-300">Highest Score</option>
                  <option value="score_low" className="bg-zinc-900 text-zinc-300">Lowest Score</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {displayedHistory.map((report) => (
            <motion.div 
              variants={itemVariants}
              key={report.id}
              onClick={() => navigate(`/report/${report.id}`)}
              className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 hover:border-primary/50 p-6 rounded-3xl cursor-pointer hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(108,99,255,0.1)] transition-all duration-300 group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-700/50 group-hover:border-primary/30 group-hover:bg-primary/10 transition-colors">
                  <FileBarChart className="text-slate-400 group-hover:text-primary transition-colors" size={24} />
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                  report.score >= 90 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 
                  report.score >= 50 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  {report.score}/100
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 truncate group-hover:text-primary transition-colors">{report.url}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
                <Clock size={16} />
                <span>{new Date(report.timestamp).toLocaleDateString()}</span>
              </div>

              <div className="mt-auto pt-5 border-t border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="flex -space-x-1">
                      <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[10px] text-red-400 font-black">
                        {report.report?.overview?.severity_breakdown?.Critical || 0}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[10px] text-orange-400 font-black">
                        {report.report?.overview?.severity_breakdown?.Serious || 0}
                      </div>
                   </div>
                   <span className="text-xs font-medium text-slate-400 ml-1">Key Issues</span>
                </div>
                <ArrowRight size={20} className="text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>
          ))}

          {!history.length && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-700 rounded-3xl">
              <p className="text-slate-500 font-medium">No reports generated yet. Start a new scan to see results here.</p>
            </div>
          )}
        </motion.div>

      </div>
    </PageTransition>
  );
}
