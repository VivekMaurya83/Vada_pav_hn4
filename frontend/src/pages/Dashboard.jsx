import React from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, FolderKanban, ArrowUpRight, ArrowDownRight, ScanLine, Clock, ShieldAlert } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageTransition from '../components/layout/PageTransition';

const trendData = [
  { name: 'Jan', score: 65 },
  { name: 'Feb', score: 72 },
  { name: 'Mar', score: 68 },
  { name: 'Apr', score: 85 },
  { name: 'May', score: 82 },
  { name: 'Jun', score: 91 },
  { name: 'Jul', score: 88 },
];

const recentScans = [
  { id: 1, url: 'https://ecommerce-demo.com', score: 88, status: 'Passed', time: '2h ago', issues: 12 },
  { id: 2, url: 'https://blog-internal.io', score: 62, status: 'Warning', time: '5h ago', issues: 34 },
  { id: 3, url: 'https://marketing-site.dev', score: 95, status: 'Passed', time: '1d ago', issues: 2 },
  { id: 4, url: 'https://admin-portal.net', score: 45, status: 'Critical', time: '2d ago', issues: 89 },
];

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

export default function Dashboard() {
  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
            <p className="text-slate-400">Welcome to your accessibility overview.</p>
          </div>
          <button className="flex items-center gap-2 bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/40 hover:bg-primary/90 hover:-translate-y-0.5 transition-all">
            <ScanLine size={18} />
            New Scan
          </button>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Stat Card 1 */}
          <motion.div variants={itemVariants} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800/80 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Activity size={24} />
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium bg-emerald-400/10 px-2 py-1 rounded-md">
                +12% <ArrowUpRight size={14} />
              </span>
            </div>
            <h3 className="text-slate-400 font-medium mb-1">Avg Accessibility Score</h3>
            <h2 className="text-3xl font-bold text-white">88<span className="text-xl text-slate-500">/100</span></h2>
          </motion.div>

          {/* Stat Card 2 */}
          <motion.div variants={itemVariants} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800/80 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                <AlertTriangle size={24} />
              </div>
              <span className="flex items-center gap-1 text-accent text-sm font-medium bg-accent/10 px-2 py-1 rounded-md">
                -5% <ArrowDownRight size={14} />
              </span>
            </div>
            <h3 className="text-slate-400 font-medium mb-1">Unresolved Issues</h3>
            <h2 className="text-3xl font-bold text-white">137</h2>
          </motion.div>

          {/* Stat Card 3 */}
          <motion.div variants={itemVariants} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800/80 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                <FolderKanban size={24} />
              </div>
            </div>
            <h3 className="text-slate-400 font-medium mb-1">Active Projects</h3>
            <h2 className="text-3xl font-bold text-white">12</h2>
          </motion.div>
        </motion.div>

        {/* Charts & Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          
          {/* Trend Graph */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Score Trend</h3>
              <select className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-primary focus:border-primary px-3 py-1.5 outline-none">
                <option>Last 7 months</option>
                <option>This Year</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }}
                    itemStyle={{ color: '#6C63FF' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#6C63FF" 
                    strokeWidth={4}
                    dot={{ fill: '#6C63FF', strokeWidth: 2, r: 6, stroke: '#0f172a' }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Recent Scans */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="lg:col-span-1 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Recent Scans</h3>
              <button className="text-primary text-sm hover:underline font-medium">View All</button>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {recentScans.map((scan) => (
                <div key={scan.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-primary/50 transition-colors group cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <div className="truncate pr-2 max-w-[70%]">
                      <p className="text-sm font-medium text-slate-200 truncate group-hover:text-primary transition-colors">{scan.url}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                      scan.status === 'Passed' ? 'bg-emerald-400/10 text-emerald-400' : 
                      scan.status === 'Warning' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {scan.score}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-3">
                    <span className="flex items-center gap-1"><Clock size={12} /> {scan.time}</span>
                    <span className="flex items-center gap-1"><ShieldAlert size={12} className={scan.issues > 20 ? 'text-accent' : ''} /> {scan.issues} issues</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          
        </div>
      </div>
    </PageTransition>
  );
}
