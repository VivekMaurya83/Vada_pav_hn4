/**
 * AccessiSimulate – Keyboard Trap Mode
 * Completely disables the mouse and visualizes the tab order.
 */

(function () {
  const BADGE_CLASS = 'accessi-tab-badge';
  const FOCUS_STYLE_ID = 'accessi-focus-style';
  const MOUSE_BLOCK_STYLE_ID = 'accessi-mouse-block';

  window.KeyboardTrap = {
    _active: false,
    _badges: [],
    _blockedEvents: ['click', 'mousedown', 'mouseup', 'mouseover', 'mouseenter', 'mouseleave', 'contextmenu'],
    _captureHandler: null,

    enable() {
      if (this._active) return;
      this._active = true;

      // 1. Block ALL mouse events at capture phase (before page receives them)
      this._captureHandler = (e) => {
        // Allow clicks on our own panel
        if (e.target?.closest?.('#accessi-sim-panel') || e.target?.closest?.('#accessi-sim-panel *')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      this._blockedEvents.forEach(evName => {
        document.addEventListener(evName, this._captureHandler, { capture: true, passive: false });
      });

      // 2. Inject aggressive focus ring styles
      this._injectStyle(FOCUS_STYLE_ID, `
        *:focus, *:focus-visible, *:focus-within {
          outline: 3px solid #a855f7 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 6px rgba(168,85,247,0.25) !important;
          border-radius: 2px !important;
          transition: outline 0.1s ease !important;
        }
      `);

      // 3. Change cursor to "not-allowed" to signal mouse is disabled
      this._injectStyle(MOUSE_BLOCK_STYLE_ID, `
        *, *::before, *::after {
          cursor: not-allowed !important;
        }
        #accessi-sim-panel, #accessi-sim-panel * {
          cursor: auto !important;
        }
      `);

      // 4. Render tab order badges after a tick
      setTimeout(() => this._renderTabBadges(), 300);
    },

    disable() {
      if (!this._active) return;
      this._active = false;

      // Remove mouse block listeners
      if (this._captureHandler) {
        this._blockedEvents.forEach(evName => {
          document.removeEventListener(evName, this._captureHandler, { capture: true });
        });
        this._captureHandler = null;
      }

      // Remove styles
      document.getElementById(FOCUS_STYLE_ID)?.remove();
      document.getElementById(MOUSE_BLOCK_STYLE_ID)?.remove();

      // Remove badges
      this._clearTabBadges();
    },

    _renderTabBadges() {
      this._clearTabBadges();

      const focusableSelectors = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])', '[role="button"]', '[role="link"]'
      ].join(', ');

      const elements = Array.from(document.querySelectorAll(focusableSelectors))
        .filter(el => {
          if (el.closest('#accessi-sim-panel')) return false; // exclude our panel
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 &&
            style.visibility !== 'hidden' && style.display !== 'none';
        });

      // Sort by tab index if set
      elements.sort((a, b) => {
        const ta = parseInt(a.getAttribute('tabindex') || '0') || 0;
        const tb = parseInt(b.getAttribute('tabindex') || '0') || 0;
        if (ta === tb) return 0;
        if (ta === 0) return 1;
        if (tb === 0) return -1;
        return ta - tb;
      });

      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < -50 || rect.top > window.innerHeight + 50) return; // skip off-screen

        const badge = document.createElement('div');
        badge.className = BADGE_CLASS;
        badge.textContent = index + 1;

        const hasLabel = el.getAttribute('aria-label') || el.getAttribute('title') ||
          el.textContent?.trim() || el.getAttribute('alt');
        const bgColor = hasLabel ? '#10b981' : '#ef4444'; // green=ok, red=missing label

        Object.assign(badge.style, {
          position: 'fixed',
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`,
          transform: 'translate(-8px, -8px)',
          width: '18px',
          height: '18px',
          background: bgColor,
          color: '#fff',
          fontSize: '10px',
          fontWeight: '700',
          fontFamily: 'monospace',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '2147483646',
          pointerEvents: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          lineHeight: '1'
        });

        document.body.appendChild(badge);
        this._badges.push(badge);
      });
    },

    _clearTabBadges() {
      this._badges.forEach(b => b.remove());
      this._badges = [];
      document.querySelectorAll(`.${BADGE_CLASS}`).forEach(b => b.remove());
    },

    _injectStyle(id, css) {
      document.getElementById(id)?.remove();
      const style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    },

    // Tab trap detector mode — passive, just watches
    enableTrapDetector() {
      this._injectStyle(FOCUS_STYLE_ID, `
        *:focus, *:focus-visible {
          outline: 3px solid #f59e0b !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 6px rgba(245,158,11,0.25) !important;
        }
      `);
      setTimeout(() => this._renderTabBadges(), 300);
    }
  };
})();
