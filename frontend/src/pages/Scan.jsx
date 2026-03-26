import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, Chrome, Upload, Download, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useScanStore } from '../store/useScanStore';
import PageTransition from '../components/layout/PageTransition';
import ExtensionManagement from '../components/sections/ExtensionManagement';

export default function Scan() {
  const navigate = useNavigate();
  const { isScanning, scanProgress, startScan, url, setUrl } = useScanStore();
  const [activeTab, setActiveTab] = useState('url');
  const [wcagLevel, setWcagLevel] = useState('AA');

  // Auto-trigger scan if url is provided via store (e.g. from Navigation Discovery)
  React.useEffect(() => {
    if (url && !isScanning) {
      handleScan();
    }
  }, []);

  const handleScan = async (e) => {
    if (e) e.preventDefault();
    if (!url) return;
    
    const targetUrl = url;
    // Clear the store URL immediately so it doesn't re-trigger on back navigation
    if (!e) setUrl(''); 

    try {
      await startScan(targetUrl, wcagLevel);
      navigate('/report/current');
    } catch (err) {
      alert(`Scan failed: ${err}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('File selected:', file.name);
      navigate('/report/m-123'); // Redirect to report ID
    }
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-8 font-sans">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Accessibility Scanner</h1>
          <p className="text-slate-400">Audit your web applications for WCAG compliance.</p>
        </div>

        {/* Tabs Header */}
        <div className="flex p-1 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700/50 w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('url')}
            className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors w-full sm:w-auto overflow-hidden ${
              activeTab === 'url' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeTab === 'url' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-slate-700/80 border border-slate-600 rounded-xl -z-10 shadow-sm"
              />
            )}
            <Globe size={18} />
            URL Scanner
          </button>
          
          <button
            onClick={() => setActiveTab('extension')}
            className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors w-full sm:w-auto overflow-hidden ${
              activeTab === 'extension' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeTab === 'extension' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-slate-700/80 border border-slate-600 rounded-xl -z-10 shadow-sm"
              />
            )}
            <Chrome size={18} />
            Chrome Extension
          </button>
        </div>

        {/* Tabs Content */}
        <div className="relative mt-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            
            {/* URL SCANNER TAB */}
            {activeTab === 'url' && (
              <motion.div
                key="url"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6 sm:p-10 rounded-3xl shadow-xl"
              >
                <div className="max-w-xl mx-auto text-center space-y-8">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto text-primary border border-primary/20 shadow-inner">
                    <Search size={32} />
                  </div>
                  
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Scan Live URL</h2>
                    <p className="text-slate-400">Enter any public URL to initiate a comprehensive WCAG accessibility audit in the cloud.</p>
                  </div>

                  <form onSubmit={handleScan} className="relative mt-8">
                    <div className="relative flex items-center">
                      <Globe className="absolute left-4 text-slate-500" size={20} />
                      <input 
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        required
                        disabled={isScanning}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-36 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner disabled:opacity-50"
                      />
                      <button 
                        type="submit"
                        disabled={isScanning || !url}
                        className="absolute right-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 disabled:opacity-50 text-slate-900 font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-primary/25 flex items-center gap-2"
                      >
                        {isScanning ? 'Scanning' : 'Scan Now'}
                        {!isScanning && <ArrowRight size={18} />}
                      </button>
                    </div>
                  </form>

                  {/* WCAG Level Picker */}
                  {!isScanning && url && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3">WCAG Conformance Level</p>
                      <div className="flex gap-3 justify-center">
                        {['A', 'AA', 'AAA'].map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setWcagLevel(level)}
                            className={`flex-1 py-3 rounded-xl border font-black text-sm transition-all duration-200 ${
                              wcagLevel === level
                              ? 'bg-primary border-primary text-slate-900 shadow-lg shadow-primary/30'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                            }`}
                          >
                            {level}
                            <span className="block text-[9px] font-normal mt-0.5 opacity-70">
                              {level === 'A' ? 'Basic' : level === 'AA' ? 'Standard' : 'Enhanced'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mock Loading State */}
                  <AnimatePresence>
                    {isScanning && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-8"
                      >
                        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 text-left shadow-inner">
                          <div className="flex justify-between items-center mb-4 text-sm font-medium">
                            <span className="text-white flex items-center gap-3">
                              <Loader2 className="animate-spin text-primary" size={18} />
                              Analyzing DOM structures & contrast...
                            </span>
                            <span className="text-primary font-bold">{scanProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                            <motion.div 
                              className="bg-gradient-to-r from-primary to-secondary h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${scanProgress}%` }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </motion.div>
            )}

            {/* EXTENSION TAB */}
            {activeTab === 'extension' && (
              <motion.div
                key="extension"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ExtensionManagement onFileUpload={handleFileUpload} />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
