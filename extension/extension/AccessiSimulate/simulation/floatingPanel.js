/**
 * AccessiSimulate – Floating HUD Panel
 * Injected directly into the page as a self-contained, inline-styled element.
 * Appended to document.body with max z-index so body filters don't escape it.
 * All styles are 100% inline — no external CSS dependency.
 */

(function () {
  const PANEL_ID = 'accessi-sim-panel';

  window.FloatingPanel = {
    _el: null,
    _issueList: null,
    _modeLabel: null,
    _analyzeBtn: null,
    _loadingEl: null,

    create(mode) {
      this.remove(); // always start fresh

      const info = window.SIMULATION_INFO?.[mode] || { label: mode, description: '', icon: '👁️' };

      const panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.setAttribute('data-accessi-panel', 'true');

      // Outer panel — fully inline styles, isolated from page styles
      Object.assign(panel.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '320px',
        maxHeight: '480px',
        background: '#0a0a14',
        border: '1px solid rgba(168,85,247,0.6)',
        borderRadius: '14px',
        boxShadow: '0 0 40px rgba(168,85,247,0.25), 0 20px 40px rgba(0,0,0,0.6)',
        zIndex: '2147483647',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '13px',
        color: '#f1f5f9',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        lineHeight: '1.4',
        boxSizing: 'border-box',
        // Isolate from any page-level CSS filter using a self-rendering context
        isolation: 'isolate',
        backdropFilter: 'none'
      });

      // Header bar
      const header = document.createElement('div');
      Object.assign(header.style, {
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: '0'
      });

      const logoSpan = document.createElement('span');
      logoSpan.textContent = '👁️ AccessiSimulate';
      Object.assign(logoSpan.style, { fontWeight: '700', fontSize: '13px', color: '#fff' });

      const closeBtn = this._makeButton('✕', '#7c3aed', () => {
        // Tell content.js to stop simulation
        chrome.runtime.sendMessage({ action: 'STOP_SIMULATION' });
        window.SimulationEngine?.deactivate();
        this.remove();
      });
      Object.assign(closeBtn.style, {
        background: 'rgba(255,255,255,0.15)',
        border: 'none',
        borderRadius: '50%',
        width: '22px',
        height: '22px',
        cursor: 'pointer',
        color: '#fff',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        flexShrink: '0'
      });

      header.appendChild(logoSpan);
      header.appendChild(closeBtn);

      // Mode label section
      const modeSection = document.createElement('div');
      Object.assign(modeSection.style, {
        padding: '10px 14px 6px',
        borderBottom: '1px solid rgba(168,85,247,0.2)',
        flexShrink: '0'
      });

      const modeBadge = document.createElement('div');
      modeBadge.id = 'accessi-mode-badge';
      Object.assign(modeBadge.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(168,85,247,0.15)',
        border: '1px solid rgba(168,85,247,0.4)',
        borderRadius: '20px',
        padding: '3px 10px',
        fontSize: '11px',
        fontWeight: '600',
        color: '#c084fc',
        marginBottom: '5px'
      });
      modeBadge.textContent = `${info.icon} ${info.label}`;

      const modeDesc = document.createElement('p');
      modeDesc.id = 'accessi-mode-desc';
      modeDesc.textContent = info.description;
      Object.assign(modeDesc.style, {
        margin: '0',
        fontSize: '11px',
        color: '#94a3b8',
        lineHeight: '1.4'
      });

      modeSection.appendChild(modeBadge);
      modeSection.appendChild(modeDesc);

      // Issues section
      const issuesSection = document.createElement('div');
      Object.assign(issuesSection.style, {
        padding: '8px 14px',
        overflowY: 'auto',
        flexGrow: '1',
        maxHeight: '200px'
      });

      const issuesTitle = document.createElement('div');
      issuesTitle.textContent = '🤖 AI Analysis';
      Object.assign(issuesTitle.style, {
        fontWeight: '600',
        fontSize: '11px',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginBottom: '6px'
      });

      const issueList = document.createElement('div');
      issueList.id = 'accessi-issue-list';
      issueList.textContent = 'Click "Analyze with AI" to detect issues in this simulation mode.';
      Object.assign(issueList.style, {
        color: '#64748b',
        fontSize: '12px',
        fontStyle: 'italic'
      });

      issuesSection.appendChild(issuesTitle);
      issuesSection.appendChild(issueList);

      // Loading indicator
      const loadingEl = document.createElement('div');
      loadingEl.id = 'accessi-panel-loading';
      loadingEl.textContent = '⏳ Groq AI analyzing page...';
      Object.assign(loadingEl.style, {
        display: 'none',
        padding: '4px 14px',
        fontSize: '12px',
        color: '#a855f7',
        fontStyle: 'italic'
      });

      // Footer buttons
      const footer = document.createElement('div');
      Object.assign(footer.style, {
        padding: '8px 14px 12px',
        borderTop: '1px solid rgba(168,85,247,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: '0'
      });

      const analyzeBtn = this._makeButton('🤖 Analyze with Groq AI', '#a855f7', () => {
        window.GroqAnalyzer?.analyze(mode);
      });
      Object.assign(analyzeBtn.style, {
        width: '100%',
        padding: '8px',
        background: 'rgba(168,85,247,0.15)',
        border: '1px solid rgba(168,85,247,0.5)',
        borderRadius: '8px',
        color: '#c084fc',
        fontWeight: '600',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s'
      });
      analyzeBtn.id = 'accessi-analyze-btn';
      analyzeBtn.onmouseover = () => { analyzeBtn.style.background = 'rgba(168,85,247,0.3)'; };
      analyzeBtn.onmouseout = () => { analyzeBtn.style.background = 'rgba(168,85,247,0.15)'; };

      const exitBtn = this._makeButton('⏹ Exit Simulation', 'transparent', () => {
        window.SimulationEngine?.deactivate();
        this.remove();
      });
      Object.assign(exitBtn.style, {
        width: '100%',
        padding: '7px',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '8px',
        color: '#f87171',
        fontWeight: '600',
        fontSize: '12px',
        cursor: 'pointer'
      });
      exitBtn.onmouseover = () => { exitBtn.style.background = 'rgba(239,68,68,0.25)'; };
      exitBtn.onmouseout = () => { exitBtn.style.background = 'rgba(239,68,68,0.1)'; };

      footer.appendChild(analyzeBtn);
      footer.appendChild(exitBtn);

      // Assemble
      panel.appendChild(header);
      panel.appendChild(modeSection);
      panel.appendChild(issuesSection);
      panel.appendChild(loadingEl);
      panel.appendChild(footer);

      document.body.appendChild(panel);

      // Store refs
      this._el = panel;
      this._issueList = issueList;
      this._modeLabel = modeBadge;
      this._analyzeBtn = analyzeBtn;
      this._loadingEl = loadingEl;
    },

    showLoading(show) {
      if (this._loadingEl) {
        this._loadingEl.style.display = show ? 'block' : 'none';
      }
      if (this._analyzeBtn) {
        this._analyzeBtn.disabled = show;
        this._analyzeBtn.style.opacity = show ? '0.5' : '1';
      }
    },

    showIssues(issues) {
      if (!this._issueList) return;

      if (!issues || issues.length === 0) {
        this._issueList.innerHTML = '';
        const noIssues = document.createElement('div');
        noIssues.textContent = '✅ No critical issues detected in this simulation mode.';
        Object.assign(noIssues.style, { color: '#10b981', fontSize: '12px' });
        this._issueList.appendChild(noIssues);
        return;
      }

      this._issueList.innerHTML = '';
      const countEl = document.createElement('div');
      countEl.textContent = `Found ${issues.length} issue${issues.length !== 1 ? 's' : ''}:`;
      Object.assign(countEl.style, {
        fontWeight: '600',
        color: '#f59e0b',
        fontSize: '12px',
        marginBottom: '6px'
      });
      this._issueList.appendChild(countEl);

      issues.slice(0, 8).forEach((issue, i) => {
        const item = document.createElement('div');
        Object.assign(item.style, {
          display: 'flex',
          gap: '6px',
          marginBottom: '5px',
          padding: '5px 8px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '6px',
          borderLeft: `3px solid ${this._severityColor(issue.severity)}`,
          alignItems: 'flex-start'
        });

        const sevDot = document.createElement('span');
        sevDot.textContent = this._severityIcon(issue.severity);
        sevDot.style.flexShrink = '0';

        const text = document.createElement('div');
        Object.assign(text.style, { fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' });

        const elemSpan = document.createElement('strong');
        elemSpan.textContent = (issue.element || '').slice(0, 30) + (issue.element?.length > 30 ? '…' : '');
        elemSpan.style.color = '#e2e8f0';

        const issueSpan = document.createElement('span');
        issueSpan.textContent = ': ' + (issue.issue || '');

        text.appendChild(elemSpan);
        text.appendChild(issueSpan);
        item.appendChild(sevDot);
        item.appendChild(text);
        this._issueList.appendChild(item);
      });

      if (issues.length > 8) {
        const more = document.createElement('div');
        more.textContent = `+ ${issues.length - 8} more issues…`;
        Object.assign(more.style, { color: '#64748b', fontSize: '11px', marginTop: '4px' });
        this._issueList.appendChild(more);
      }
    },

    remove() {
      document.getElementById(PANEL_ID)?.remove();
      this._el = null;
      this._issueList = null;
    },

    _makeButton(text, bg, onClick) {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.backgroundColor = bg;
      btn.addEventListener('click', onClick);
      return btn;
    },

    _severityColor(sev) {
      return { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[sev] || '#64748b';
    },

    _severityIcon(sev) {
      return { high: '🔴', medium: '🟡', low: '🟢' }[sev] || '⚪';
    }
  };
})();
