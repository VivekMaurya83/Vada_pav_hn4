/**
 * AccessiSimulate – Content Script Orchestrator
 * Receives messages from popup and delegates to SimulationEngine.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AccessiSimulate] Content received:', request.action, request.mode || '');

  if (request.action === 'START_SIMULATION') {
    try {
      window.SimulationEngine?.activate(request.mode);
      sendResponse({ success: true });
    } catch (err) {
      console.error('[AccessiSimulate] Error activating simulation:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (request.action === 'STOP_SIMULATION') {
    try {
      window.SimulationEngine?.deactivate();
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (request.action === 'GET_CURRENT_MODE') {
    sendResponse({ mode: window.SimulationEngine?.currentMode || null });
    return true;
  }
});

console.log('[AccessiSimulate] Content script ready.');
