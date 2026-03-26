import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useScanStore } from '../../store/useScanStore';
import { 
  LayoutDashboard, Target, FolderKanban, FileBarChart, 
  Chrome, Settings, X, Activity, TrendingUp 
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Scan Website', path: '/scan', icon: Target },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Reports', path: '/reports', icon: FileBarChart },
  { name: 'Trends & History', path: '/analytics', icon: TrendingUp },
  { name: 'Chrome Extension', path: '/extension', icon: Chrome }, 
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { history, fetchHistory, loadReport } = useScanStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleHistoryClick = (item) => {
    loadReport(item.report);
    setIsOpen(false);
    navigate(`/report/${item.id}`);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar background */}
      <aside className={`fixed inset-y-0 left-0 bg-slate-900 border-r border-slate-800 w-64 transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg text-primary">
              <Activity size={24} />
            </div>
            <span className="text-xl font-bold text-primary hover:opacity-80 transition-opacity">
              AccessiScan
            </span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-primary text-slate-900 shadow-lg shadow-primary/25' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}
              `}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}

          {/* Recent Scans Section */}
          <div className="pt-6 mt-6 border-t border-slate-800">
            <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center justify-between">
              Recent Scans
              <button 
                onClick={(e) => { e.preventDefault(); fetchHistory(); }}
                className="hover:text-primary transition-colors p-1"
                title="Refresh history"
              >
                <Activity size={12} className="opacity-50" />
              </button>
            </h3>
            
            <div className="space-y-1">
              {history.length > 0 ? (
                history.map((scan) => (
                  <button
                    key={scan.id}
                    onClick={() => handleHistoryClick(scan)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-left group"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${scan.score > 80 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : scan.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{scan.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <span className="text-[9px] font-mono text-slate-600 uppercase">Score: {scan.score}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-[10px] text-slate-600 italic">
                  No recent scans found
                </div>
              )}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
