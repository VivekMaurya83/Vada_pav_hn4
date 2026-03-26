/**
 * AccessiSimulate – Popup Controller
 * Handles tab switching, mode activation, and UI state updates.
 */

(function () {
  'use strict';

  // ── DOM References ─────────────────────────────────────────────────────
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const modeCards = document.querySelectorAll('.mode-card');
  const btnExitAll = document.getElementById('btn-exit-all');
  const activeBadge = document.getElementById('active-badge');
  const activeModeLabel = document.getElementById('active-mode-label');

  // ── State ──────────────────────────────────────────────────────────────
  let currentActiveMode = null;

  // Mode → human label map
  const MODE_LABELS = {
    protanopia:   '🔴 Red-Blind (Protanopia)',
    deuteranopia: '🟢 Green-Blind (Deuteranopia)',
    tritanopia:   '🔵 Blue-Blind (Tritanopia)',
    lowvision:    '👁️ Low Vision',
    tunnel:       '🕳️ Tunnel Vision',
    screenreader: '🔊 Screen Reader',
    keyboard:     '⌨️ Keyboard Only',
    tabtrap:      '🪤 Tab Trap Detector',
    slowmotor:    '🤲 Tremor / Slow Motor'
  };

  // ── Tab Switching ──────────────────────────────────────────────────────
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${target}`)?.classList.add('active');
    });
  });

  // ── Mode Card Clicks ───────────────────────────────────────────────────
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      if (!mode) return;

      // If clicking the already-active mode → toggle off
      if (currentActiveMode === mode) {
        deactivateAll();
        return;
      }

      activateMode(mode);
    });
  });

  // ── Exit Button ────────────────────────────────────────────────────────
  btnExitAll.addEventListener('click', deactivateAll);

  // ── Core Functions ─────────────────────────────────────────────────────

  function activateMode(mode) {
    sendToPage('START_SIMULATION', { mode }, (response) => {
      if (response?.success === false) {
        console.error('[AccessiSimulate Popup] Activation failed:', response.error);
        if (response.error !== 'RESTRICTED_URL') {
          showError('Failed to activate simulation. Try reloading the page.');
        }
        return;
      }
      currentActiveMode = mode;
      updateUI(mode);
    });
  }

  function deactivateAll() {
    sendToPage('STOP_SIMULATION', {}, () => {
      currentActiveMode = null;
      updateUI(null);
    });
  }

  function updateUI(activeMode) {
    // Update mode cards
    modeCards.forEach(card => {
      const isActive = card.dataset.mode === activeMode;
      card.classList.toggle('active-mode', isActive);
      const dot = document.getElementById(`dot-${card.dataset.mode}`);
      if (dot) dot.style.background = isActive ? '#10b981' : '';
    });

    // Update header badge
    if (activeMode) {
      activeBadge.classList.remove('hidden');
      activeModeLabel.textContent = MODE_LABELS[activeMode] || activeMode;
      activeModeLabel.style.color = '#a855f7';
      activeModeLabel.style.fontStyle = 'normal';
      activeModeLabel.style.fontWeight = '600';
      btnExitAll.disabled = false;
    } else {
      activeBadge.classList.add('hidden');
      activeModeLabel.textContent = 'No simulation active';
      activeModeLabel.style.color = '';
      activeModeLabel.style.fontStyle = 'italic';
      activeModeLabel.style.fontWeight = '';
      btnExitAll.disabled = true;
    }
  }

  // ── Message Helper ─────────────────────────────────────────────────────

  function sendToPage(action, payload = {}, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) {
        console.warn('[AccessiSimulate] No active tab found.');
        callback?.({ success: false, error: 'No active tab' });
        return;
      }

      // Check for restricted URLs (like chrome://newtab)
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('https://chrome.google.com/webstore'))) {
        showError('Cannot run on this page. Please navigate to a normal website (e.g. google.com).');
        callback?.({ success: false, error: 'RESTRICTED_URL' });
        return;
      }

      // Inject content scripts first if not already present, then send message
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => typeof window.SimulationEngine !== 'undefined'
      }).then((results) => {
        const isInjected = results?.[0]?.result;

        const doSend = () => {
          chrome.tabs.sendMessage(tab.id, { action, ...payload }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[AccessiSimulate]', chrome.runtime.lastError.message);
              callback?.({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            callback?.(response);
          });
        };

        if (!isInjected) {
          // Content scripts not yet loaded on this tab — inject them
          injectContentScripts(tab.id).then(doSend).catch(err => {
            console.error('[AccessiSimulate] Script injection failed:', err);
            callback?.({ success: false, error: err.message });
          });
        } else {
          doSend();
        }
      }).catch(err => {
        console.error('[AccessiSimulate] executeScript check failed:', err);
        callback?.({ success: false, error: err.message });
      });
    });
  }

  async function injectContentScripts(tabId) {
    const scripts = [
      'simulation/colorMatrices.js',
      'simulation/floatingPanel.js',
      'simulation/keyboardTrap.js',
      'simulation/groqAnalyzer.js',
      'simulation/simulation.js',
      'content.js'
    ];
    for (const file of scripts) {
      await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
    }
  }

  // ── Error Toast ────────────────────────────────────────────────────────
  function showError(msg) {
    const existing = document.getElementById('popup-error');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'popup-error';
    Object.assign(el.style, {
      position: 'fixed', bottom: '50px', left: '16px', right: '16px',
      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
      color: '#f87171', borderRadius: '6px', padding: '8px 12px',
      fontSize: '12px', zIndex: '9999'
    });
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ── Init — Restore State ───────────────────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { action: 'GET_CURRENT_MODE' }, (response) => {
      if (chrome.runtime.lastError) return; // scripts not loaded yet — that's fine
      if (response?.mode) {
        currentActiveMode = response.mode;
        updateUI(response.mode);
        // Jump to the correct tab
        const info = { protanopia:'colorblind', deuteranopia:'colorblind', tritanopia:'colorblind',
                       lowvision:'visual', tunnel:'visual', screenreader:'visual',
                       keyboard:'motor', tabtrap:'motor', slowmotor:'motor' };
        const tabId = info[response.mode];
        if (tabId) {
          document.querySelector(`[data-tab="${tabId}"]`)?.click();
        }
      }
    });
  });

})();
