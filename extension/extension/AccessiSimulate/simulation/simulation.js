/**
 * AccessiSimulate – Main Simulation Engine
 * Handles all 9 simulation modes via CSS injection, SVG filters, and DOM overlays.
 * 
 * KEY INJECTION STRATEGY (avoids CSS conflicts):
 * - SVG filter definition → appended to document.body (with height:0, invisible)
 * - Filter applied to document.body via <style> tag
 * - Floating panel lives on document.body with z-index 2147483647
 * - All injected elements use data-accessi="true" for reliable cleanup
 * - All IDs are prefixed with "accessi-" to avoid collisions
 */

(function () {

  // ─── ID Registry ──────────────────────────────────────────────────────────
  const IDS = {
    SVG: 'accessi-svg-defs',
    STYLE: 'accessi-sim-style',
    OVERLAY: 'accessi-sim-overlay',
    BLUR_STYLE: 'accessi-blur-style',
    FOCUS_STYLE: 'accessi-focus-style',
    CURSOR_STYLE: 'accessi-cursor-style',
    TREMOR_STYLE: 'accessi-tremor-style',
    SR_PANEL: 'accessi-sr-panel'
  };

  class SimulationEngineClass {
    constructor() {
      this.currentMode = null;
      this._srSpeaking = false;
      this._srCancelled = false;
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    activate(mode) {
      try {
        this.deactivate(); // Always full cleanup first
        this.currentMode = mode;
        console.log(`[AccessiSimulate] Activating mode: ${mode}`);

        switch (mode) {
          case 'protanopia':
          case 'deuteranopia':
          case 'tritanopia':
            this._activateColorBlind(mode);
            break;
          case 'lowvision':
            this._activateLowVision();
            break;
          case 'tunnel':
            this._activateTunnelVision();
            break;
          case 'screenreader':
            this._activateScreenReader();
            break;
          case 'keyboard':
            this._activateKeyboardOnly();
            break;
          case 'tabtrap':
            this._activateTabTrapDetector();
            break;
          case 'slowmotor':
            this._activateSlowMotor();
            break;
          default:
            console.warn('[AccessiSimulate] Unknown mode:', mode);
        }


      } catch (err) {
        console.error('[AccessiSimulate] Activation error:', err);
        this.deactivate();
      }
    }

    deactivate() {
      // 1. Remove all injected <style> and <svg> elements
      Object.values(IDS).forEach(id => document.getElementById(id)?.remove());

      // 2. Remove overlay div
      document.getElementById(IDS.OVERLAY)?.remove();
      document.querySelectorAll('[data-accessi-overlay]').forEach(el => el.remove());

      // 3. Remove html/body classes
      document.documentElement.classList.remove(
        'accessi-cb-active', 'accessi-lowvision-active',
        'accessi-tunnel-active', 'accessi-sr-active'
      );

      // 4. Remove inline body filter (belt & suspenders)
      document.body.style.removeProperty('filter');
      document.body.style.removeProperty('webkitFilter');

      // 5. Stop screen reader
      this._stopScreenReader();

      // 6. Disable keyboard trap
      window.KeyboardTrap?.disable();



      this.currentMode = null;
      console.log('[AccessiSimulate] Deactivated — all injected elements removed.');
    }

    // ─── Color Blindness ──────────────────────────────────────────────────────

    _activateColorBlind(mode) {
      const matrix = window.COLOR_MATRICES?.[mode];
      if (!matrix) {
        console.error('[AccessiSimulate] No matrix found for mode:', mode);
        return;
      }

      // Step 1: Inject SVG filter definition into body
      const svgContainer = document.createElement('div');
      svgContainer.id = IDS.SVG;
      svgContainer.setAttribute('data-accessi', 'true');
      svgContainer.setAttribute('aria-hidden', 'true');
      svgContainer.style.cssText = [
        'position: absolute !important',
        'top: 0 !important',
        'left: 0 !important',
        'width: 0 !important',
        'height: 0 !important',
        'overflow: hidden !important',
        'pointer-events: none !important',
        'visibility: hidden !important',
        'z-index: -1 !important'
      ].join(';');

      svgContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;top:-9999px;left:-9999px;">
          <defs>
            <filter id="accessi-cbf" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
              <feColorMatrix type="matrix" values="${matrix}"/>
            </filter>
          </defs>
        </svg>`;

      // Append to body BEFORE applying style
      document.body.appendChild(svgContainer);

      // Step 2: Apply filter to body via <style> tag
      // This is more reliable than setting body.style.filter directly
      // because it correctly resolves the svg:// filter URL in all browsers.
      this._injectStyle(IDS.STYLE, `
        body:not([data-accessi-panel]) {
          filter: url(#accessi-cbf) !important;
          -webkit-filter: url(#accessi-cbf) !important;
        }
        /* Ensure our panel is never filtered */
        #accessi-sim-panel {
          filter: none !important;
          -webkit-filter: none !important;
          isolation: isolate !important;
        }
      `);

      // Step 3: As a redundant fallback, also set on body element directly
      // Force a style recalc by reading a layout property first
      void document.body.offsetHeight;
      document.body.style.setProperty('filter', `url(#accessi-cbf)`, 'important');
    }

    // ─── Low Vision ─────────────────────────────────────────────────────────

    _activateLowVision() {
      this._injectStyle(IDS.STYLE, `
        body {
          filter: blur(1.2px) contrast(0.55) brightness(0.88) saturate(0.7) !important;
          -webkit-filter: blur(1.2px) contrast(0.55) brightness(0.88) saturate(0.7) !important;
        }
        #accessi-sim-panel {
          filter: none !important;
          -webkit-filter: none !important;
        }
      `);

      void document.body.offsetHeight;
      document.body.style.setProperty('filter', 'blur(1.2px) contrast(0.55) brightness(0.88) saturate(0.7)', 'important');
    }

    // ─── Tunnel Vision ───────────────────────────────────────────────────────

    _activateTunnelVision() {
      // Create a fixed overlay with radial gradient — only center is visible
      const overlay = document.createElement('div');
      overlay.id = IDS.OVERLAY;
      overlay.setAttribute('data-accessi', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('data-accessi-overlay', 'true');

      Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '2147483646',
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 28% 28% at 50% 50%, transparent 0%, transparent 30%, rgba(0,0,0,0.97) 68%)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%'
      });

      document.body.appendChild(overlay);

      // Also slightly darken body to emphasize the effect
      this._injectStyle(IDS.STYLE, `
        #accessi-sim-panel {
          filter: none !important;
        }
      `);
    }

    // ─── Screen Reader Simulation ─────────────────────────────────────────────

    _activateScreenReader() {
      // Phase 1: Dim the page
      this._injectStyle(IDS.STYLE, `
        body {
          filter: grayscale(1) brightness(0.35) !important;
          -webkit-filter: grayscale(1) brightness(0.35) !important;
        }
        #accessi-sim-panel {
          filter: none !important;
          -webkit-filter: none !important;
        }
      `);

      void document.body.offsetHeight;
      document.body.style.setProperty('filter', 'grayscale(1) brightness(0.35)', 'important');

      // Phase 2: Create speech narration panel
      const srPanel = document.createElement('div');
      srPanel.id = IDS.SR_PANEL;
      srPanel.setAttribute('data-accessi', 'true');
      Object.assign(srPanel.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '420px',
        background: '#0a0a14',
        border: '1px solid rgba(168,85,247,0.5)',
        borderRadius: '12px',
        padding: '14px 18px',
        zIndex: '2147483646',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#f1f5f9',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        fontSize: '13px'
      });

      const srTitle = document.createElement('div');
      srTitle.style.cssText = 'font-weight:700; color:#a855f7; margin-bottom:8px; font-size:14px;';
      srTitle.textContent = '🔊 Screen Reader Simulation';

      const srCurrent = document.createElement('div');
      srCurrent.id = 'accessi-sr-current';
      srCurrent.style.cssText = 'color:#94a3b8; font-size:12px; line-height:1.5; margin-bottom:10px; min-height:36px;';
      srCurrent.textContent = 'Narrating page content…';

      const srControls = document.createElement('div');
      srControls.style.cssText = 'display:flex; gap:8px;';

      const btnPause = document.createElement('button');
      btnPause.textContent = '⏸ Pause';
      Object.assign(btnPause.style, {
        padding: '5px 12px', background: 'rgba(168,85,247,0.15)',
        border: '1px solid rgba(168,85,247,0.4)', borderRadius: '6px',
        color: '#c084fc', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
      });
      btnPause.onclick = () => {
        if (speechSynthesis.speaking) speechSynthesis.pause();
        else speechSynthesis.resume();
        btnPause.textContent = speechSynthesis.paused ? '▶ Resume' : '⏸ Pause';
      };

      const btnStop = document.createElement('button');
      btnStop.textContent = '⏹ Stop';
      Object.assign(btnStop.style, {
        padding: '5px 12px', background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
        color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
      });
      btnStop.onclick = () => this._stopScreenReader();

      srControls.appendChild(btnPause);
      srControls.appendChild(btnStop);
      srPanel.appendChild(srTitle);
      srPanel.appendChild(srCurrent);
      srPanel.appendChild(srControls);
      document.body.appendChild(srPanel);

      // Phase 3: Start narrating
      this._startNarration(srCurrent);
    }

    _startNarration(displayEl) {
      this._srCancelled = false;
      const elements = Array.from(document.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, button, a, input, label, img, [role="alert"], [role="banner"], [aria-label]'
      )).filter(el => {
        if (el.closest('#accessi-sim-panel') || el.closest(`#${IDS.SR_PANEL}`)) return false;
        const cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      }).slice(0, 25);

      const narrateNext = (index) => {
        if (this._srCancelled || index >= elements.length) return;
        const el = elements[index];

        const tag = el.tagName.toLowerCase();
        const text = el.getAttribute('aria-label') ||
          el.getAttribute('alt') ||
          el.textContent?.trim() || '';
        const role = el.getAttribute('role') || tag;

        const prefix = {
          h1: 'Heading level 1', h2: 'Heading level 2', h3: 'Heading level 3',
          h4: 'Heading level 4', button: 'Button', a: 'Link',
          input: 'Input field', img: 'Image', label: 'Label'
        }[tag] || role;

        const display = `${prefix}: "${text.slice(0, 80)}"`;
        if (displayEl) displayEl.textContent = display;

        // Highlight current element
        const prevHighlight = document.querySelector('[data-accessi-narrating]');
        if (prevHighlight) {
          prevHighlight.style.removeProperty('outline');
          prevHighlight.removeAttribute('data-accessi-narrating');
        }
        el.style.setProperty('outline', '3px solid #a855f7', 'important');
        el.setAttribute('data-accessi-narrating', 'true');
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });

        // Speak
        if ('speechSynthesis' in window) {
          const utt = new SpeechSynthesisUtterance(display);
          utt.rate = 0.9;
          utt.onend = () => setTimeout(() => narrateNext(index + 1), 400);
          utt.onerror = () => setTimeout(() => narrateNext(index + 1), 400);
          speechSynthesis.cancel();
          speechSynthesis.speak(utt);
        } else {
          setTimeout(() => narrateNext(index + 1), 1200);
        }
      };

      narrateNext(0);
    }

    _stopScreenReader() {
      this._srCancelled = true;
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const highlighted = document.querySelectorAll('[data-accessi-narrating]');
      highlighted.forEach(el => {
        el.style.removeProperty('outline');
        el.removeAttribute('data-accessi-narrating');
      });
    }

    // ─── Keyboard Only ────────────────────────────────────────────────────────

    _activateKeyboardOnly() {
      window.KeyboardTrap?.enable();

      // Very subtle visual de-emphasis of the mouse-driven UI
      this._injectStyle(IDS.STYLE, `
        * { user-select: none !important; }
        #accessi-sim-panel, #accessi-sim-panel * { user-select: auto !important; }
      `);
    }

    // ─── Tab Trap Detector ────────────────────────────────────────────────────

    _activateTabTrapDetector() {
      window.KeyboardTrap?.enableTrapDetector();

      // Orange focus ring to differentiate from keyboard mode
      this._injectStyle(IDS.STYLE, `
        *:focus, *:focus-visible {
          outline: 3px solid #f59e0b !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 6px rgba(245,158,11,0.25) !important;
        }
        #accessi-sim-panel, #accessi-sim-panel *:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `);
    }

    // ─── Slow Motor / Tremor ──────────────────────────────────────────────────

    _activateSlowMotor() {
      this._injectStyle(IDS.TREMOR_STYLE, `
        @keyframes accessi-tremor {
          0%   { transform: translate(0px, 0px); }
          10%  { transform: translate(-2px, 1px); }
          20%  { transform: translate(2px, -2px); }
          30%  { transform: translate(-1px, 3px); }
          40%  { transform: translate(3px, -1px); }
          50%  { transform: translate(-2px, 2px); }
          60%  { transform: translate(1px, -3px); }
          70%  { transform: translate(-3px, 1px); }
          80%  { transform: translate(2px, 2px); }
          90%  { transform: translate(-1px, -2px); }
          100% { transform: translate(0px, 0px); }
        }

        /* Shake all buttons/links when hovered to simulate tremor difficulty */
        button:hover, a:hover, input[type="submit"]:hover,
        input[type="button"]:hover, [role="button"]:hover {
          animation: accessi-tremor 0.15s infinite !important;
        }

        /* Show dangerous small targets with a red outline */
        button, a, input, select, textarea, [role="button"] {
          cursor: crosshair !important;
          transition: outline 0.1s !important;
        }

        /* Highlight dangerously small click targets (< 44x44px equivalent) */
        button:not([data-accessi-panel] *),
        a:not([data-accessi-panel] *) {
          outline: 1px dashed rgba(239,68,68,0.4) !important;
        }

        #accessi-sim-panel, #accessi-sim-panel * {
          animation: none !important;
          filter: none !important;
          outline: none !important;
        }
      `);

      this._injectStyle(IDS.STYLE, `
        /* Subtle grayscale to de-emphasize visual hierarchy and expose reliance on color */
        body {
          filter: saturate(0.6) !important;
          -webkit-filter: saturate(0.6) !important;
        }
        #accessi-sim-panel {
          filter: none !important;
          -webkit-filter: none !important;
        }
      `);
    }

    // ─── Style Utility ───────────────────────────────────────────────────────

    _injectStyle(id, css) {
      document.getElementById(id)?.remove();
      const style = document.createElement('style');
      style.id = id;
      style.setAttribute('data-accessi', 'true');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  window.SimulationEngine = new SimulationEngineClass();
  console.log('[AccessiSimulate] Simulation Engine loaded.');
})();
