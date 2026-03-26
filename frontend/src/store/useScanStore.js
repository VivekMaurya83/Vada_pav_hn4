import { create } from 'zustand';
import { api } from '../services/api';

export const useScanStore = create((set) => ({
  isScanning: false,
  scanProgress: 0,
  report: null,
  history: [],
  error: null,
  url: '',

  setUrl: (url) => set({ url }),

  startScan: async (url, wcagLevel = 'AA') => {
    set({ isScanning: true, scanProgress: 0, error: null, report: null });
    
    // Fake progress for UX
    const progressInterval = setInterval(() => {
      set((state) => ({ 
        scanProgress: Math.min(state.scanProgress + 3, 90) 
      }));
    }, 800);

    try {
      const report = await api.scanUrl(url, wcagLevel);
      set({ report, scanProgress: 100, isScanning: false });
      
      // Refresh history immediately after successful scan
      const updatedHistory = await api.getHistory();
      set({ history: updatedHistory });
      
      return report;
    } catch (err) {
      set({ error: err.message, isScanning: false });
      throw err;
    } finally {
      clearInterval(progressInterval);
    }
  },

  resetScan: () => set({ isScanning: false, scanProgress: 0, report: null, error: null }),

  fetchHistory: async () => {
    try {
      const history = await api.getHistory();
      set({ history });
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  },

  loadReport: (report) => {
    set({ report, scanProgress: 100, isScanning: false, error: null });
  }
}));
