import React from 'react';
import { motion } from 'framer-motion';
import { Chrome, Globe, Download, CheckCircle, Upload } from 'lucide-react';

export default function ExtensionManagement({ onFileUpload }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AccessiBrowser Download Card */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-xl flex flex-col h-full hover:border-primary/30 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-6 shadow-inner border border-primary/20">
            <Chrome size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">AccessiBrowser</h2>
          <p className="text-slate-400 mb-8 leading-relaxed flex-1">
            Our core auditing engine. Scan live pages, internal dashboards, and authenticated environments for WCAG violations.
          </p>
          
          <a 
            href="/accessibrowser.zip" 
            download="accessibrowser.zip"
            className="w-full bg-primary hover:bg-primary/90 text-slate-900 font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group"
          >
            <Download size={18} className="group-hover:-translate-y-0.5 transition-transform" />
            Download AccessiBrowser
          </a>
        </div>

        {/* AccessiSimulate Download Card */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-xl flex flex-col h-full hover:border-secondary/30 transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary mb-6 shadow-inner border border-secondary/20">
            <Globe size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">AccessiSimulate</h2>
          <p className="text-slate-400 mb-8 leading-relaxed flex-1">
            Experience your web app through the eyes of users with disabilities. Simulations for color blindness, low vision, and more.
          </p>
          
          <a 
            href="/accessisimulate.zip" 
            download="accessisimulate.zip"
            className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group"
          >
            <Download size={18} className="group-hover:-translate-y-0.5 transition-transform" />
            Download AccessiSimulate
          </a>
        </div>
      </div>

      {/* Installation Guide */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-3xl p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <CheckCircle className="text-primary" size={24} />
          How to install in Chrome
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {[
            { step: "01", title: "Download & Extract", desc: "Download both ZIP files and extract them into individual folders." },
            { step: "02", title: "Open Extensions", desc: "Open Chrome and navigate to chrome://extensions/ in the URL bar." },
            { step: "03", title: "Developer Mode", desc: "Enable the 'Developer mode' toggle in the top right corner." },
            { step: "04", title: "Load Unpacked", desc: "Click 'Load unpacked' and select the unzipped extension folders." }
          ].map((item, idx) => (
            <div key={idx} className="space-y-3">
              <span className="text-3xl font-black text-slate-800 block">{item.step}</span>
              <h4 className="font-bold text-white text-sm">{item.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
