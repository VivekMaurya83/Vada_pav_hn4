import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, Cell, AreaChart, Area,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  TrendingUp, Activity, ShieldAlert, AlertTriangle, 
  Clock, Calendar, Filter, Download as DownloadIcon,
  BarChart3, LayoutGrid, ListFilter, Search, CheckCircle2,
  Trophy, Info, HelpCircle, CheckCircle
} from 'lucide-react';
import { useScanStore } from '../store/useScanStore';
import PageTransition from '../components/layout/PageTransition';

// Native date formatter
const formatDate = (date, formatStr) => {
  const d = new Date(date);
  if (formatStr === 'MMM dd') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (formatStr === 'PP') {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (formatStr === 'p') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleString();
};

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

export default function Analytics() {
  const { history, fetchHistory } = useScanStore();
  const [selectedScans, setSelectedScans] = React.useState(new Set());
  const [isComparing, setIsComparing] = React.useState(false);
  const [filterHost, setFilterHost] = React.useState('All');

  const getHost = (urlString) => {
    try {
      return new URL(urlString).host;
    } catch (e) {
      return urlString;
    }
  };

  const uniqueHosts = useMemo(() => [...new Set(history.map(h => getHost(h.url)))], [history]);

  const filteredHistory = useMemo(() => {
    return history.filter(h => filterHost === 'All' || getHost(h.url) === filterHost);
  }, [history, filterHost]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleScanSelection = (id) => {
    const newSelection = new Set(selectedScans);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedScans(newSelection);
  };

  const selectedScansData = useMemo(() => {
    return history.filter(scan => selectedScans.has(scan.id));
  }, [history, selectedScans]);

  const comparisonData = useMemo(() => {
    if (selectedScansData.length < 2) return [];
    return selectedScansData.map(scan => ({
      name: scan.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 15),
      id: scan.id,
      score: scan.score,
      critical: scan.report?.overview?.severity_breakdown?.Critical || 0,
      serious: scan.report?.overview?.severity_breakdown?.Serious || 0,
      timestamp: formatDate(scan.timestamp, 'MMM dd')
    }));
  }, [selectedScansData]);

  const pourComparisonData = useMemo(() => {
    if (selectedScansData.length < 2) return [];
    const categories = ['Perceivable', 'Operable', 'Understandable', 'Robust'];
    return categories.map(cat => {
      const entry = { name: cat };
      selectedScansData.forEach(scan => {
        const shortUrl = scan.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 10);
        entry[shortUrl] = scan.report?.overview?.pour_scores?.[cat] || 0;
      });
      return entry;
    });
  }, [selectedScansData]);

  const commonIssues = useMemo(() => {
    if (selectedScansData.length < 2) return [];
    const issueSets = selectedScansData.map(scan => 
      new Set((scan.report?.issues || []).map(i => i.title))
    );
    
    // Intersection of all issue sets
    const intersection = [...issueSets[0]].filter(issue => 
      issueSets.every(set => set.has(issue))
    );

    return intersection.slice(0, 5).map(title => ({
      title,
      frequency: selectedScansData.length
    }));
  }, [selectedScansData]);

  const disabilityComparisonData = useMemo(() => {
    if (selectedScansData.length < 2) return [];
    const categories = ['Visual', 'Motor', 'Hearing', 'Cognitive'];
    
    const getDisabilityCategory = (issue) => {
      const text = (issue.title + issue.description).toLowerCase();
      if (/image|alt|color|contrast|reader|aria|label|font|zoom/i.test(text)) return 'Visual';
      if (/keyboard|focus|tab|link|button|click|target/i.test(text)) return 'Motor';
      if (/video|audio|caption|transcript|media|sound/i.test(text)) return 'Hearing';
      return 'Cognitive'; // Default/Fallback
    };

    return categories.map(cat => {
      const entry = { name: cat };
      selectedScansData.forEach(scan => {
        const shortUrl = scan.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 10);
        entry[shortUrl] = (scan.report?.issues || []).filter(i => getDisabilityCategory(i) === cat).length;
      });
      return entry;
    });
  }, [selectedScansData]);

  const finalVerdict = useMemo(() => {
    if (selectedScansData.length < 2) return null;
    
    const winner = [...selectedScansData].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aCritical = a.report?.overview?.severity_breakdown?.Critical || 0;
      const bCritical = b.report?.overview?.severity_breakdown?.Critical || 0;
      return aCritical - bCritical;
    })[0];

    const reasons = [
      `Highest overall compliance score of ${winner.score}/100.`,
      `Managed to maintain fewer critical accessibility blockers compared to peers.`,
      `Demonstrates superior handling of ${winner.report?.overview?.pour_scores?.Perceivable > 80 ? 'Perceivable' : 'Operable'} content requirements.`,
      `Lower impact on ${disabilityComparisonData.find(d => d.name === 'Visual')?.[winner.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 10)] < 5 ? 'Visual' : 'Cognitive'} disability categories.`
    ];

    return { 
      winner: winner.url.replace(/^https?:\/\/(www\.)?/, ''), 
      reasons,
      score: winner.score
    };
  }, [selectedScansData, disabilityComparisonData]);

  // Data processing for visualizations
  const stats = useMemo(() => {
    if (!filteredHistory.length) return { total: 0, avg: 0, trend: 0 };
    const total = filteredHistory.length;
    const avg = Math.round(filteredHistory.reduce((acc, curr) => acc + curr.score, 0) / total);
    // Rough "improvement" trend (comparing latest 5 to previous 5)
    const latestScore = filteredHistory[0]?.score || 0;
    const prevScore = filteredHistory[filteredHistory.length - 1]?.score || 0;
    const trend = latestScore - prevScore;
    return { total, avg, trend };
  }, [filteredHistory]);

  const chartData = useMemo(() => {
    // Group and sort data for the line chart (chronological)
    return [...filteredHistory].reverse().map(item => ({
      name: formatDate(item.timestamp, 'MMM dd'),
      score: item.score,
      fullDate: formatDate(item.timestamp, 'PPpp'),
      url: item.url.replace(/^https?:\/\/(www\.)?/, '')
    }));
  }, [filteredHistory]);

  const severityData = useMemo(() => {
    // Aggregate issue types across all scans
    const aggregation = { Critical: 0, Serious: 0, Moderate: 0, Minor: 0 };
    filteredHistory.forEach(scan => {
      const breakdown = scan.report?.overview?.severity_breakdown || {};
      Object.keys(aggregation).forEach(key => {
        aggregation[key] += (breakdown[key] || 0);
      });
    });
    return Object.entries(aggregation).map(([name, value]) => ({ name, value }));
  }, [filteredHistory]);

  const topViolations = useMemo(() => {
    // Find recurring issue types
    const counts = {};
    filteredHistory.forEach(scan => {
      (scan.report?.issues || []).forEach(issue => {
        const title = issue.title;
        counts[title] = (counts[title] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));
  }, [filteredHistory]);

  return (
    <PageTransition>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[1600px] mx-auto space-y-8 p-4 md:p-8"
      >
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
              <TrendingUp className="text-primary" size={36} />
              Trends & Analytics
            </h1>
            <p className="text-slate-400 font-medium">Holistic accessibility monitoring across all projects.</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            {uniqueHosts.length > 0 && (
              <div className="relative">
                <select 
                  value={filterHost} 
                  onChange={(e) => setFilterHost(e.target.value)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white pl-4 pr-10 py-2.5 rounded-xl border border-slate-700 transition-all text-sm font-bold appearance-none cursor-pointer outline-none focus:ring-2 ring-primary/50 shadow-lg"
                >
                  <option value="All" className="bg-slate-800 text-white">All Progress</option>
                  {uniqueHosts.map(host => <option key={host} value={host} className="bg-slate-800 text-white">{host}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            )}
            <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl border border-slate-700 transition-all text-sm font-bold">
              <DownloadIcon size={18} /> Export Data
            </button>
            <button className="flex items-center gap-2 bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-black shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all text-sm">
              <Activity size={18} /> Sync History
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all"></div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                <BarChart3 size={24} />
              </div>
              <span className={`text-sm font-black px-3 py-1 rounded-full ${stats.trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {stats.trend > 0 ? '+' : ''}{stats.trend}% vs start
              </span>
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Average Compliance</p>
            <h2 className="text-4xl font-black text-white">{stats.avg}<span className="text-xl text-slate-600">/100</span></h2>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary/10 rounded-full blur-3xl group-hover:bg-secondary/20 transition-all"></div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-secondary/10 text-secondary rounded-2xl border border-secondary/20">
                <ShieldAlert size={24} />
              </div>
              <span className="text-sm font-black text-slate-400 bg-slate-400/10 px-3 py-1 rounded-full uppercase">Lifetime Scans</span>
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Total Audits</p>
            <h2 className="text-4xl font-black text-white">{stats.total}</h2>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all"></div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-accent/10 text-accent rounded-2xl border border-accent/20">
                <Activity size={24} />
              </div>
            </div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Recent Activity</p>
            <div className="flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
               <span className="text-white font-black">Online & Syncing</span>
            </div>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Progress Over Time */}
          <motion.div variants={itemVariants} className="bg-slate-800/20 backdrop-blur-xl border border-slate-700/30 p-8 rounded-[2.5rem] shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Compliance Progress</h3>
                <p className="text-xs text-slate-500 font-medium">Evolution of accessibility scores across all tracked pages.</p>
              </div>
              <select className="bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 ring-primary/50">
                <option>Last 30 Days</option>
                <option>Last 6 Months</option>
              </select>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={15}
                    fontFamily="Inter, sans-serif"
                    fontWeight="bold"
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    dx={-10}
                    domain={[0, 100]}
                    fontFamily="Inter, sans-serif"
                    fontWeight="bold"
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1.5rem', color: '#f8fafc', padding: '15px' }}
                    itemStyle={{ color: '#6C63FF', fontWeight: 'bold' }}
                    cursor={{ stroke: '#6C63FF', strokeWidth: 2, strokeDasharray: '4 4' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#6C63FF" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    animationDuration={2000}
                    dot={{ fill: '#6C63FF', r: 4, strokeWidth: 2, stroke: '#0f172a' }}
                    activeDot={{ r: 8, strokeWidth: 0, fill: '#6C63FF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Issue Severity Distribution */}
          <motion.div variants={itemVariants} className="bg-slate-800/20 backdrop-blur-xl border border-slate-700/30 p-8 rounded-[2.5rem] shadow-2xl">
             <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Issue Severity Distribution</h3>
                <p className="text-xs text-slate-500 font-medium">Aggregated breakdown of technical debt by risk level.</p>
              </div>
            </div>

            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} opacity={0.3} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      width={80} 
                      tickLine={false} 
                      axisLine={false}
                      fontWeight="bold"
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(108, 99, 255, 0.05)' }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem' }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 20, 20, 0]} 
                      barSize={40}
                      animationDuration={1500}
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          entry.name === 'Critical' ? '#ef4444' :
                          entry.name === 'Serious' ? '#f97316' :
                          entry.name === 'Moderate' ? '#eab308' : '#64748b'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Bottom Row: Comparison & Patterns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
           {/* Comparison Analysis (Visible when isComparing is true) */}
           {isComparing && selectedScansData.length >= 2 && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="lg:col-span-3 bg-slate-800/20 backdrop-blur-xl border border-primary/40 p-10 rounded-[3rem] shadow-2xl relative"
             >
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h3 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                       <BarChart3 className="text-primary" size={32} />
                       Benchmarking Analysis
                    </h3>
                    <p className="text-slate-400 font-medium">Deep-dive comparison of accessibility performance across selected audits.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedScans(new Set())}
                      className="text-sm font-bold text-slate-500 hover:text-white transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button 
                      onClick={() => setIsComparing(false)}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all border border-slate-600 shadow-lg"
                    >
                      Back to History
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="h-[300px]">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Score Benchmarking</h4>
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                            <Tooltip 
                              cursor={{ fill: 'rgba(108, 99, 255, 0.05)' }}
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem' }}
                            />
                            <Bar dataKey="score" fill="#6C63FF" radius={[10, 10, 0, 0]} barSize={40} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                   <div className="h-[300px]">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Risk Comparison (Critical vs Serious)</h4>
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip 
                              cursor={{ fill: 'rgba(108, 99, 255, 0.05)' }}
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem' }}
                            />
                            <Legend verticalAlign="top" height={36}/>
                            <Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[10, 10, 0, 0]} barSize={30} />
                            <Bar dataKey="serious" name="Serious" fill="#f97316" radius={[10, 10, 0, 0]} barSize={30} />
                         </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                {/* Final Verdict Section */}
                {finalVerdict && (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="mt-16 bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 p-10 rounded-[3rem] relative overflow-hidden"
                   >
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                         <Trophy size={160} className="text-primary" />
                      </div>
                      <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
                         <div className="flex-shrink-0 text-center">
                            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-slate-900 shadow-[0_0_40px_rgba(108,99,255,0.4)] md:mx-auto mb-4">
                               <Trophy size={48} />
                            </div>
                            <h4 className="text-primary font-black uppercase tracking-[0.3em] text-[10px]">Comparative Winner</h4>
                         </div>
                         <div className="flex-1">
                            <h3 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">
                               {finalVerdict.winner}
                            </h3>
                            <div className="space-y-4">
                               {finalVerdict.reasons.map((reason, idx) => (
                                 <div key={idx} className="flex items-start gap-4">
                                    <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                                    <p className="text-lg text-slate-300 font-medium leading-relaxed">{reason}</p>
                                 </div>
                               ))}
                            </div>
                         </div>
                         <div className="bg-slate-900/40 p-10 rounded-3xl border border-white/5 backdrop-blur-sm self-stretch flex flex-col justify-center">
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">Verdict Score</p>
                            <span className="text-6xl font-black text-white">{finalVerdict.score}</span>
                            <div className="mt-4 flex items-center gap-2 text-primary font-bold">
                               <CheckCircle size={18} /> Verified Audit
                            </div>
                         </div>
                      </div>
                   </motion.div>
                )}

                {/* Advanced Comparison: POUR, Disability & Overlap */}
                <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-12 border-t border-slate-700/50 pt-12">
                   <div className="h-[400px]">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                         <Activity size={14} className="text-primary" />
                         POUR Principle Benchmarking
                      </h4>
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={pourComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} opacity={0.2} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem' }}
                            />
                            <Legend iconType="circle" />
                            {selectedScansData.map((scan, idx) => (
                               <Bar 
                                 key={scan.id} 
                                 dataKey={scan.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 10)} 
                                 fill={idx === 0 ? '#6C63FF' : idx === 1 ? '#00D1FF' : idx === 2 ? '#FF00A8' : '#F97316'} 
                                 radius={[4, 4, 0, 0]}
                                 barSize={selectedScansData.length > 3 ? 15 : 25}
                               />
                            ))}
                         </BarChart>
                      </ResponsiveContainer>
                   </div>

                   <div className="h-[400px]">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                         <Info size={14} className="text-secondary" />
                         Disability Impact Benchmarking
                      </h4>
                      <ResponsiveContainer width="100%" height="100%">
                         <RadarChart cx="50%" cy="50%" outerRadius="80%" data={disabilityComparisonData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#475569', fontSize: 10 }} />
                            {selectedScansData.map((scan, idx) => (
                               <Radar 
                                 key={scan.id}
                                 name={scan.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 10)}
                                 dataKey={scan.url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 10)}
                                 stroke={idx === 0 ? '#6C63FF' : idx === 1 ? '#00D1FF' : idx === 2 ? '#FF00A8' : '#F97316'}
                                 fill={idx === 0 ? '#6C63FF' : idx === 1 ? '#00D1FF' : idx === 2 ? '#FF00A8' : '#F97316'}
                                 fillOpacity={0.4} 
                               />
                            ))}
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem' }} />
                            <Legend />
                         </RadarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="mt-12 grid grid-cols-1 gap-8">
                   <div className="flex flex-col">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                         <ShieldAlert size={14} className="text-red-400" />
                         Common Violations Overlap
                      </h4>
                      <div className="space-y-3">
                         {commonIssues.map((issue, idx) => (
                           <div key={idx} className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl flex justify-between items-center group">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-white mb-1">{issue.title}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Affects all {issue.frequency} selected projects</p>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center">
                                 <AlertTriangle size={14} className="text-red-400" />
                              </div>
                           </div>
                         ))}
                         {commonIssues.length === 0 && (
                            <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800 flex flex-col items-center">
                               <CheckCircle2 className="text-emerald-500 mb-3" size={32} />
                               <p className="text-slate-500 text-sm font-bold">No common violations found among selection.</p>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
             </motion.div>
           )}

          {/* Pattern Detection */}
          <motion.div variants={itemVariants} className="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-700/30 p-8 rounded-[2.5rem]">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
               <ListFilter size={20} className="text-primary" />
               Recurring Patterns
            </h3>
            <div className="space-y-4">
               {topViolations.map((v, i) => (
                 <div key={i} className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex justify-between items-center group hover:border-primary/50 transition-all">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-bold text-slate-200 truncate">{v.title}</p>
                      <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">Found in {v.count} Scans</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm group-hover:bg-primary group-hover:text-slate-900 transition-all">
                      {v.count}
                    </div>
                 </div>
               ))}
               {!topViolations.length && (
                 <div className="text-center py-12 text-slate-600 italic text-sm">No patterns identified yet.</div>
               )}
            </div>
          </motion.div>

          {/* Full History List */}
          <motion.div variants={itemVariants} className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-700/30 p-8 rounded-[2.5rem] flex flex-col relative overflow-hidden">
             
             {/* Selection Banner */}
             {selectedScans.size > 0 && !isComparing && (
               <motion.div 
                 initial={{ y: 80, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-primary p-2 rounded-2xl shadow-[0_20px_50px_rgba(108,99,255,0.5)] flex items-center gap-4 border border-white/20"
               >
                  <div className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest">
                    {selectedScans.size} Selected
                  </div>
                  <button 
                    disabled={selectedScans.size < 2}
                    onClick={() => setIsComparing(true)}
                    className={`px-6 py-2 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${
                      selectedScans.size >= 2 
                      ? 'bg-slate-900 text-white hover:bg-black cursor-pointer shadow-lg' 
                      : 'bg-slate-900/50 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <BarChart3 size={16} />
                    Compare {selectedScans.size} Audits
                  </button>
                  <button 
                    onClick={() => setSelectedScans(new Set())}
                    className="text-slate-900 font-bold text-xs pr-4 hover:underline transition-all"
                  >
                    Cancel
                  </button>
               </motion.div>
             )}

             <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                 <Clock size={20} className="text-secondary" />
                 Audit Trail
               </h3>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Filter by URL..." 
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl pl-10 pr-4 py-2 outline-none focus:ring-2 ring-secondary/50"
                />
                <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[400px]">
               {filteredHistory.map((scan, i) => (
                 <motion.div 
                   key={scan.id}
                   whileHover={{ x: 5 }}
                   className={`p-4 rounded-2xl bg-slate-800/30 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer ${
                     selectedScans.has(scan.id) ? 'border-primary/50 bg-primary/5' : 'border-slate-700/30 hover:bg-slate-800/50 hover:border-secondary/50'
                   }`}
                   onClick={(e) => {
                     if (e.target.tagName !== 'INPUT') {
                        window.location.href = `/report/${scan.id}`;
                     }
                   }}
                 >
                   <div className="flex items-center gap-4 min-w-0">
                      <input 
                        type="checkbox" 
                        checked={selectedScans.has(scan.id)}
                        onChange={() => toggleScanSelection(scan.id)}
                        className="w-5 h-5 rounded-lg accent-primary cursor-pointer shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-lg ${
                        scan.score > 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/20' :
                        scan.score > 50 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/20' :
                        'bg-red-500/20 text-red-400 border border-red-400/20'
                      }`}>
                        {scan.score}
                      </div>
                      <div className="min-w-0">
                        <a 
                          href={scan.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-white hover:text-primary transition-colors block truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                           {scan.url}
                        </a>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-medium font-mono">
                          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700/50 uppercase tracking-tighter">ID: {scan.id.substring(0, 8)}</span>
                          <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(scan.timestamp, 'PP')}</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(scan.timestamp, 'p')}</span>
                        </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4 shrink-0">
                      <div className="flex -space-x-2">
                         {/* Visual indicator of issues */}
                         {[...Array(3)].map((_, j) => (
                            <div key={j} className={`w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[8px] font-black ${
                              j === 0 ? 'text-red-400' : j === 1 ? 'text-orange-400' : 'text-yellow-400'
                            }`}>
                               {j === 0 ? scan.report?.overview?.severity_breakdown?.Critical : 
                                j === 1 ? scan.report?.overview?.severity_breakdown?.Serious : 
                                scan.report?.overview?.severity_breakdown?.Moderate}
                            </div>
                         ))}
                      </div>
                   </div>
                 </motion.div>
               ))}
               {!filteredHistory.length && (
                 <div className="flex flex-col items-center justify-center py-20 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
                    <LayoutGrid size={48} className="text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold">No scan history available yet.</p>
                 </div>
               )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </PageTransition>
  );
}
