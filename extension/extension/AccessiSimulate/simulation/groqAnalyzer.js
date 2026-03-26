/**
 * AccessiSimulate – Groq AI Analyzer
 * Collects DOM data, builds mode-specific prompts, calls Groq, displays results.
 */

(function () {
  window.GroqAnalyzer = {

    async analyze(mode) {
      window.FloatingPanel?.showLoading(true);
      try {
        const info = window.SIMULATION_INFO?.[mode];
        const pillar = info?.pillar || 'colorblind';
        let issues = [];

        if (pillar === 'colorblind') {
          issues = await this._analyzeColorBlind(mode);
        } else if (pillar === 'visual') {
          issues = await this._analyzeVisual(mode);
        } else if (pillar === 'motor') {
          issues = await this._analyzeMotor(mode);
        }

        window.FloatingPanel?.showLoading(false);
        window.FloatingPanel?.showIssues(issues);
      } catch (err) {
        console.error('AccessiSimulate GroqAnalyzer error:', err);
        window.FloatingPanel?.showLoading(false);
        window.FloatingPanel?.showIssues([{
          element: 'Groq API',
          issue: `Analysis failed: ${err.message}`,
          severity: 'high'
        }]);
      }
    },

    // ──────────────────────────────────────────────
    // COLOR BLINDNESS ANALYSIS
    // ──────────────────────────────────────────────
    async _analyzeColorBlind(mode) {
      const elements = this._collectColoredElements();
      if (elements.length === 0) return [];

      const modeLabels = {
        protanopia: 'Protanopia (Red-Blind)',
        deuteranopia: 'Deuteranopia (Green-Blind)',
        tritanopia: 'Tritanopia (Blue-Blind)'
      };

      const elementList = elements.slice(0, 30).map((el, i) =>
        `${i + 1}. Tag: ${el.tag}, Text: "${el.text}", Color: ${el.color}, Background: ${el.bg}, Role: ${el.role}`
      ).join('\n');

      const prompt = `You are analyzing a webpage for ${modeLabels[mode]} color blindness accessibility issues.

Here are the key interactive/text elements found on the page:
${elementList}

For ${modeLabels[mode]}, identify elements where:
1. The color conveys critical information (error/success) that would be lost
2. Foreground and background colors would appear identical or near-identical
3. Important UI elements (buttons, links, alerts) would become invisible or indistinguishable

Return ONLY a JSON array with this exact structure:
[{"element": "short description", "issue": "specific problem", "severity": "high|medium|low"}]

If no issues, return: []`;

      return await this._callGroq(prompt);
    },

    // ──────────────────────────────────────────────
    // VISUAL IMPAIRMENT ANALYSIS
    // ──────────────────────────────────────────────
    async _analyzeVisual(mode) {
      const elements = this._collectTextElements();
      const modeDescriptions = {
        lowvision: 'low vision (visual acuity 20/200, like moderate cataracts)',
        tunnel: 'tunnel vision / peripheral vision loss (only center 30% of screen visible)',
        screenreader: 'screen reader usage (relying purely on text and ARIA semantics)'
      };

      const elementList = elements.slice(0, 30).map((el, i) =>
        `${i + 1}. Tag: ${el.tag}, Text: "${el.text}", FontSize: ${el.fontSize}, AriaLabel: "${el.ariaLabel}", Role: ${el.role}`
      ).join('\n');

      const prompt = `You are analyzing a webpage for ${modeDescriptions[mode]} accessibility issues.

Here are the page elements:
${elementList}

Identify issues specifically for a user with ${modeDescriptions[mode]}.

Return ONLY a JSON array:
[{"element": "short description", "issue": "specific accessibility problem", "severity": "high|medium|low"}]

Focus on: tiny font sizes, missing alt text, missing aria-labels on icon buttons, poor heading structure, navigation not keyboard-accessible, information only conveyed via position/color.

If no issues, return: []`;

      return await this._callGroq(prompt);
    },

    // ──────────────────────────────────────────────
    // MOTOR / KEYBOARD ANALYSIS
    // ──────────────────────────────────────────────
    async _analyzeMotor(mode) {
      const elements = this._collectInteractiveElements();

      const modeDescriptions = {
        keyboard: 'keyboard-only navigation (no mouse)',
        tabtrap: 'potential focus trap detection',
        slowmotor: 'motor impairment with tremor (difficulty with small/precise click targets)'
      };

      const elementList = elements.slice(0, 40).map((el, i) =>
        `${i + 1}. Tag: ${el.tag}, Text: "${el.text}", Width: ${el.width}px, Height: ${el.height}px, HasAriaLabel: ${el.hasAriaLabel}, TabIndex: ${el.tabIndex}, Role: ${el.role}`
      ).join('\n');

      const prompt = `You are analyzing a webpage for ${modeDescriptions[mode]} accessibility issues.

Here are the interactive elements found on the page:
${elementList}

Identify issues for ${modeDescriptions[mode]}.

Return ONLY a JSON array:
[{"element": "short description", "issue": "specific problem", "severity": "high|medium|low"}]

For keyboard mode: missing aria-labels, elements with tabindex=-1 that should be reachable, missing skip links.
For tab traps: dialogs/modals that may trap focus, dynamically injected content.
For slow motor: click targets smaller than 44x44px (WCAG 2.5.5), close buttons under 24px, elements too close together.

If no issues, return: []`;

      return await this._callGroq(prompt);
    },

    // ──────────────────────────────────────────────
    // DOM COLLECTION HELPERS
    // ──────────────────────────────────────────────
    _collectColoredElements() {
      const selectors = 'button, a, h1, h2, h3, h4, p, label, input, .alert, [class*="error"], [class*="success"], [class*="warning"], [class*="btn"], [role="alert"]';
      return Array.from(document.querySelectorAll(selectors))
        .filter(el => !el.closest('#accessi-sim-panel'))
        .slice(0, 40)
        .map(el => {
          const cs = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.textContent || '').slice(0, 40).trim(),
            color: cs.color,
            bg: cs.backgroundColor,
            role: el.getAttribute('role') || ''
          };
        });
    },

    _collectTextElements() {
      const selectors = 'h1, h2, h3, h4, h5, h6, p, button, a, label, input, img, [aria-label], [role="img"]';
      return Array.from(document.querySelectorAll(selectors))
        .filter(el => !el.closest('#accessi-sim-panel'))
        .slice(0, 40)
        .map(el => {
          const cs = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.textContent || el.getAttribute('alt') || '').slice(0, 40).trim(),
            fontSize: cs.fontSize,
            ariaLabel: el.getAttribute('aria-label') || el.getAttribute('alt') || '',
            role: el.getAttribute('role') || ''
          };
        });
    },

    _collectInteractiveElements() {
      const selectors = 'button, a[href], input, select, textarea, [tabindex], [role="button"], [role="link"], [role="checkbox"], [role="menuitem"]';
      return Array.from(document.querySelectorAll(selectors))
        .filter(el => !el.closest('#accessi-sim-panel'))
        .slice(0, 50)
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.textContent || el.getAttribute('value') || '').slice(0, 40).trim(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            hasAriaLabel: !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')),
            tabIndex: el.getAttribute('tabindex') || 'auto',
            role: el.getAttribute('role') || ''
          };
        });
    },

    // ──────────────────────────────────────────────
    // GROQ API CALL VIA BACKGROUND
    // ──────────────────────────────────────────────
    async _callGroq(prompt) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'GROQ_ANALYZE', prompt }, (response) => {
          if (chrome.runtime.lastError) {
            resolve([{ element: 'Extension', issue: chrome.runtime.lastError.message, severity: 'high' }]);
            return;
          }
          if (!response?.success) {
            resolve([{ element: 'Groq API', issue: response?.error || 'Unknown error', severity: 'high' }]);
            return;
          }
          try {
            let text = response.text || '[]';
            // Strip any markdown code block wrappers
            text = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(text);
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            console.warn('AccessiSimulate: Groq response was not valid JSON:', response.text);
            resolve([{ element: 'Parse Error', issue: 'Groq response was not valid JSON. Check console.', severity: 'medium' }]);
          }
        });
      });
    }
  };
})();
