/**
 * AccessiScan — Chrome Extension Popup Logic
 * Communicates with the FastAPI backend at localhost:8000
 */

const API_BASE = "http://localhost:8000";

// ─── DOM References ────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const scanPanel    = $("#scan-panel");
const loadingPanel = $("#loading-panel");
const resultsPanel = $("#results-panel");
const errorPanel   = $("#error-panel");
const scanBtn      = $("#scan-btn");
const retryBtn     = $("#retry-btn");
const downloadBtn  = $("#download-btn");
const highlightBtn = $("#highlight-all-btn");
const currentUrl   = $("#current-url");
const issueCount   = $("#issue-count");
const issuesList   = $("#issues-list");
const errorMsg     = $("#error-msg");
const modalOverlay = $("#modal-overlay");
const modalBody    = $("#modal-body");
const modalClose   = $("#modal-close");

let scanResults = null;  // store latest scan results
const resolvedSelectors = new Set(); // store selectors that were fixed via preview

// ─── Panels ────────────────────────────────────────────────────────
function showPanel(panel) {
  [scanPanel, loadingPanel, resultsPanel, errorPanel].forEach((p) =>
    p.classList.add("hidden")
  );
  panel.classList.remove("hidden");
}

// ─── Get current tab URL ───────────────────────────────────────────
async function getCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.url || "";
  } catch {
    return "";
  }
}

// ─── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const url = await getCurrentTabUrl();
  if (url) {
    currentUrl.textContent = url;
    currentUrl.title = url;
  } else {
    currentUrl.textContent = "Unable to detect page URL";
  }
});

// ─── Scan ──────────────────────────────────────────────────────────
scanBtn.addEventListener("click", async () => {
  const url = await getCurrentTabUrl();
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
    showError("Cannot scan browser internal pages. Navigate to a website first.");
    return;
  }
  await runScan(url);
});

retryBtn.addEventListener("click", async () => {
  const url = await getCurrentTabUrl();
  if (url) await runScan(url);
});

downloadBtn?.addEventListener("click", async () => {
  if (!scanResults || !scanResults.issues || scanResults.issues.length === 0) return;
  
  const originalText = downloadBtn.innerHTML;
  downloadBtn.innerHTML = "⏳ Generating PDF...";
  downloadBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/report/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scanResults),
    });

    if (!res.ok) throw new Error("Failed to generate PDF");

    const blob = await res.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    
    const dateObj = new Date(scanResults.scanned_at || Date.now());
    const dateStr = dateObj.toISOString().split("T")[0];
    
    await new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: dataUrl,
        filename: `AccessiScan-Report-${dateStr}.pdf`,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      });
    });
    
    downloadBtn.innerHTML = "✅ Downloaded!";
  } catch (err) {
    console.error(err);
    downloadBtn.innerHTML = "❌ Failed";
  } finally {
    setTimeout(() => {
      downloadBtn.innerHTML = originalText;
      downloadBtn.disabled = false;
    }, 2000);
  }
});

highlightBtn?.addEventListener("click", async () => {
  if (!scanResults || !scanResults.issues || scanResults.issues.length === 0) return;
  
  const originalText = highlightBtn.textContent;
  highlightBtn.textContent = "⏳ Highlighting...";
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const selectorsData = scanResults.issues
        .map((i, idx) => ({ selector: i.css_selector, index: idx + 1, rule_id: i.rule_id }))
        .filter(i => i.selector && i.rule_id !== "best-practice" && i.rule_id !== "unmapped" && !resolvedSelectors.has(i.selector));
        
      if (selectorsData.length === 0) {
        highlightBtn.textContent = "No elements to highlight";
        setTimeout(() => highlightBtn.textContent = originalText, 2000);
        return;
      }
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (dataList) => {
          let count = 0;
          
          if (!document.getElementById("accessiscan-styles")) {
            const style = document.createElement("style");
            style.id = "accessiscan-styles";
            style.textContent = `
              .accessiscan-highlight {
                outline: 4px solid #e74c3c !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 10px rgba(231, 76, 60, 0.8) !important;
                position: relative !important;
                cursor: help !important;
              }
              .accessiscan-highlight::before {
                content: "#" attr(data-accessi-num) !important;
                position: absolute !important;
                top: -12px !important;
                left: -12px !important;
                background: #e74c3c !important;
                color: white !important;
                padding: 2px 6px !important;
                border-radius: 50% !important;
                font-family: sans-serif !important;
                font-size: 12px !important;
                font-weight: bold !important;
                z-index: 2147483647 !important;
                pointer-events: none !important;
              }
              .accessiscan-tooltip {
                position: absolute !important;
                background: #1a1e23 !important;
                color: #fff !important;
                padding: 12px 16px !important;
                border-radius: 8px !important;
                font-family: system-ui, sans-serif !important;
                line-height: 1.5 !important;
                width: max-content !important;
                max-width: 320px !important;
                box-shadow: 0 8px 30px rgba(0,0,0,0.5) !important;
                z-index: 2147483647 !important;
                pointer-events: none !important;
                opacity: 0;
                transition: opacity 0.2s ease, transform 0.2s ease;
                transform: translateY(5px);
                border-left: 4px solid #e74c3c !important;
                border: 1px solid #333 !important;
              }
              .accessiscan-tooltip strong { color: #e74c3c !important; display: block !important; margin-bottom: 6px !important; font-size: 14px !important; }
              .accessiscan-tooltip .tooltip-desc { font-size: 12px !important; color: #ccc !important; }
              .accessiscan-tooltip .tooltip-fix { margin-top: 8px !important; padding-top: 8px !important; border-top: 1px solid #333 !important; font-size: 11px !important; color: #e74c3c !important; }
            `;
            document.head.appendChild(style);
          }
          
          // Remove old highlights if any
          document.querySelectorAll(".accessiscan-highlight").forEach(el => {
            el.classList.remove("accessiscan-highlight");
            el.removeAttribute("data-accessi-num");
            delete el.dataset.accessiInit;
            el.style.outline = "";
            el.style.outlineOffset = "";
            el.style.boxShadow = "";
          });

          dataList.forEach(item => {
            try {
              const elements = document.querySelectorAll(item.selector);
              elements.forEach(el => {
                if (el.dataset.accessiInit) return;
                el.classList.add("accessiscan-highlight");
                el.setAttribute("data-accessi-num", item.index);
                el.dataset.accessiInit = "true";
                
                // Add Hover Tooltips
                el.addEventListener("mouseenter", (e) => {
                  let tooltip = document.getElementById("accessiscan-tooltip-el");
                  if (!tooltip) {
                    tooltip = document.createElement("div");
                    tooltip.id = "accessiscan-tooltip-el";
                    tooltip.className = "accessiscan-tooltip";
                    document.body.appendChild(tooltip);
                  }
                  
                  const safeStr = (str) => {
                     const d = document.createElement("div");
                     d.textContent = str || "";
                     return d.innerHTML;
                  };
                  
                  tooltip.innerHTML = `
                    <strong>Issue #${item.index}</strong>
                    <div class="tooltip-desc">${safeStr(item.description)}</div>
                    ${item.summary ? `<div class="tooltip-fix"><strong>Fix any:</strong> ${safeStr(item.summary)}</div>` : ''}
                  `;
                  
                  const rect = el.getBoundingClientRect();
                  tooltip.style.left = Math.max(10, rect.left + window.scrollX) + "px";
                  tooltip.style.top = Math.max(10, rect.bottom + window.scrollY + 10) + "px";
                  tooltip.style.transform = "translateY(0)";
                  tooltip.style.opacity = "1";
                });
                
                el.addEventListener("mouseleave", () => {
                   const tooltip = document.getElementById("accessiscan-tooltip-el");
                   if (tooltip) {
                     tooltip.style.opacity = "0";
                     tooltip.style.transform = "translateY(5px)";
                   }
                });
                
                el.addEventListener("click", (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  chrome.runtime.sendMessage({ type: "HIGHLIGHT_CLICKED", index: item.index });
                });
                
                count++;
              });
            } catch (e) {}
          });
          
          return count;
        },
        args: [
          scanResults.issues.map((i, idx) => ({ 
            selector: i.css_selector, 
            index: idx + 1, 
            rule_id: i.rule_id,
            description: i.description,
            summary: i.failure_summary
          })).filter(i => i.selector && i.rule_id !== "best-practice" && i.rule_id !== "unmapped" && !resolvedSelectors.has(i.selector))
        ]
      });

      highlightBtn.textContent = "✅ Highlights Applied!";
    }
  } catch (err) {
    console.error(err);
    highlightBtn.textContent = "❌ Failed";
  } finally {
    setTimeout(() => {
      if (highlightBtn.textContent !== "✅ Highlights Applied!") {
         highlightBtn.textContent = originalText;
      } else {
         setTimeout(() => highlightBtn.textContent = originalText, 2000);
      }
    }, 2000);
  }
});

async function runScan(url) {
  showPanel(loadingPanel);
  scanBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }

    scanResults = await res.json();
    renderResults(scanResults);
  } catch (err) {
    showError(err.message || "Failed to connect to the backend. Is the server running?");
  } finally {
    scanBtn.disabled = false;
  }
}

// ─── Render Results ────────────────────────────────────────────────
function renderResults(data) {
  // Update issue summary with improved display
  const totalCount = data.total_issues;
  issueCount.textContent = `${totalCount} ${totalCount === 1 ? "Issue" : "Issues"}`;
  
  // Update badge count
  const issueBadge = document.getElementById("issue-badge-count");
  if (issueBadge) {
    issueBadge.textContent = totalCount;
  }

  // Update pressed state for filter pills
  document.querySelectorAll(".pill").forEach((pill) => {
    pill.classList.remove("active");
    pill.setAttribute("aria-pressed", "false");
  });
  document.querySelector(".pill[data-filter='all']").classList.add("active");
  document.querySelector(".pill[data-filter='all']").setAttribute("aria-pressed", "true");

  // Render issue cards
  renderIssues(data.issues, "all");

  // Filter pills
  document.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-pressed", "false");
      });
      pill.classList.add("active");
      pill.setAttribute("aria-pressed", "true");
      renderIssues(data.issues, pill.dataset.filter);
    });
  });

  showPanel(resultsPanel);
}

function renderIssues(issues, filter) {
  const filtered =
    filter === "all"
      ? issues
      : issues.filter((i) => i.impact === filter);

  if (filtered.length === 0) {
    issuesList.innerHTML = `
      <div class="empty-state">
        <span>✅</span>
        <p>${filter === "all" ? "No issues found — great job!" : `No ${filter} issues found.`}</p>
      </div>`;
    return;
  }

  issuesList.innerHTML = filtered.map((issue, idx) => {
    const isBestPractice = issue.rule_id === "best-practice";
    const isUnmapped = issue.rule_id === "unmapped";
    const ruleLabel = isBestPractice ? "Best Practice" : isUnmapped ? "Unmapped" : issue.rule_id.replace(/wcag_/g, "WCAG ").replace(/_/g, ".");
    
    // WCAG criterion badge
    const criterionBadge = issue.wcag_criterion
      ? `<span class="issue-criterion">📋 ${escHtml(issue.wcag_criterion)}</span>`
      : isBestPractice
        ? `<span class="issue-criterion best-practice-badge">⭐ Best Practice</span>`
        : "";
    
    // Principle and conformance level
    const metaRow = (issue.principle || issue.conformance_level)
      ? `<div class="issue-meta">
          ${issue.principle ? `<span class="meta-tag">${escHtml(issue.principle)}</span>` : ""}
          ${issue.conformance_level ? `<span class="meta-tag level-${issue.conformance_level.toLowerCase()}">Level ${escHtml(issue.conformance_level)}</span>` : ""}
        </div>`
      : "";

    // Impact explanation block with affected users
    const impactBlock = issue.impact_description
      ? `<div class="issue-impact-block">
           <p class="impact-label">⚡ Why this matters</p>
           <p class="impact-text">${escHtml(issue.impact_description)}</p>
           ${issue.affected_users && issue.affected_users.length
             ? `<div class="affected-users">👥 Affects: ${issue.affected_users.map(u => `<span class="user-tag">${escHtml(u)}</span>`).join("")}</div>`
             : ""}
         </div>`
      : "";

    // Common failures collapsible section
    const failuresBlock = issue.common_failures && issue.common_failures.length
      ? `<details class="issue-details">
           <summary>🔎 Common failures (${issue.common_failures.length})</summary>
           <ul class="failures-list">${issue.common_failures.map(f => `<li>${escHtml(f)}</li>`).join("")}</ul>
         </details>`
      : "";

    return `
    <div class="issue-card" data-impact="${issue.impact}">
      <!-- Issue Header with Number and Impact Badge -->
      <div class="issue-top">
        <span class="issue-number">#${idx + 1}</span>
        ${issue.is_incomplete 
          ? `<span class="impact-badge impact-serious" title="This issue needs manual review">🔍 Needs Review</span>` 
          : `<span class="impact-badge impact-${issue.impact}" title="Impact level: ${issue.impact}">${impactIcon(issue.impact)} ${issue.impact.charAt(0).toUpperCase() + issue.impact.slice(1)}</span>`
        }
        <span class="issue-rule" title="Rule: ${escHtml(ruleLabel)}">${ruleLabel}</span>
      </div>
      
      <!-- WCAG Criterion -->
      ${criterionBadge}
      
      <!-- Principle and Conformance Info -->
      ${metaRow}
      
      <!-- Main Description -->
      <p class="issue-desc">${escHtml(issue.description)}</p>
      
      <!-- Specific Error/Failure Summary -->
      ${issue.failure_summary ? `<div class="issue-specific-err">
        <strong>Specific Error Found:</strong>
        <span>${escHtml(issue.failure_summary)}</span>
      </div>` : ""}
      
      <!-- Impact and Affected Users -->
      ${impactBlock}
      
      <!-- HTML Snippet Code Block -->
      ${issue.html_snippet ? `<div class="issue-snippet">${escHtml(issue.html_snippet)}</div>` : ""}
      
      <!-- Common Failures Details -->
      ${failuresBlock}
      
      <!-- Action Buttons -->
      <div class="issue-actions">
        <button class="btn-fix" data-idx="${idx}" title="Get AI-powered remediation suggestion" ${(isBestPractice || isUnmapped) && !issue.html_snippet ? "disabled" : ""}>
          🤖 Fix with AI
        </button>
        ${issue.html_snippet ? `<button class="btn-copy" data-snippet="${encodeURIComponent(issue.html_snippet)}" title="Copy the HTML snippet to clipboard">📋 Copy</button>` : ""}
      </div>
    </div>`;
  }).join("");

  // Bind card clicks for scroll-to-element
  issuesList.querySelectorAll(".issue-card").forEach((card) => {
    card.style.cursor = "pointer";
    card.addEventListener("click", async (e) => {
      // Don't scroll if clicking a button inside the card
      if (e.target.closest("button") || e.target.closest("details")) return;
      
      const idx = parseInt(card.querySelector(".btn-fix").dataset.idx);
      const issue = filtered[idx];
      
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab && issue.css_selector) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (selector) => {
            const el = document.querySelector(selector);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Visual "pulse" to show it's focused
              el.style.transition = "outline 0.3s ease";
              const originalOutline = el.style.outline;
              el.style.outline = "6px solid #6c63ff";
              setTimeout(() => el.style.outline = originalOutline, 1000);
            }
          },
          args: [issue.css_selector]
        });
      }
    });
  });

  // Bind fix buttons
  issuesList.querySelectorAll(".btn-fix").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.idx);
      openRemediation(filtered[i]);
    });
  });

  // Bind copy buttons
  issuesList.querySelectorAll(".btn-copy").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const snippet = decodeURIComponent(btn.dataset.snippet);
      navigator.clipboard.writeText(snippet).then(() => {
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = "📋 Copy"), 1500);
      });
    });
  });
}

// ─── Listen for Highlight Clicks from Page ──────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "HIGHLIGHT_CLICKED") {
    const cards = issuesList.querySelectorAll(".issue-card");
    // Find card with the matching index (1-based from the badge)
    for (const card of cards) {
      const numLabel = card.querySelector("span")?.textContent;
      if (numLabel === `#${msg.index}`) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.transition = "background 0.3s ease";
        const originalBg = card.style.background;
        card.style.background = "var(--accent-glow)";
        setTimeout(() => (card.style.background = originalBg), 1500);
        break;
      }
    }
  }
});


// ─── AI Remediation Modal ──────────────────────────────────────────
async function openRemediation(issue) {
  modalOverlay.classList.remove("hidden");
  modalBody.innerHTML = `
    <div class="modal-spinner-wrap">
      <div class="spinner small"></div>
      <p>Generating accessible fix for <strong>${escHtml(issue.rule_id)}</strong>…</p>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/api/remediate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        broken_html: issue.html_snippet,
        rule_id: issue.rule_id,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned ${res.status}`);
    }

    const data = await res.json();
    modalBody.innerHTML = `
      <p class="modal-result-label">Original HTML</p>
      <div class="modal-code" style="color: var(--red);">${escHtml(issue.html_snippet)}</div>
      <p class="modal-result-label">✅ Corrected HTML</p>
      <div class="modal-code">${escHtml(data.corrected_html)}</div>
      <div class="modal-actions" style="display: flex; gap: 10px; margin-top: 15px;">
        <button class="btn-fix" id="preview-fix-btn" style="background: #000; flex: 1; justify-content: center;">👀 Preview on Page</button>
        <button class="btn-fix" id="copy-fix-btn" style="flex: 1; justify-content: center;">📋 Copy HTML</button>
      </div>`;

    $("#preview-fix-btn")?.addEventListener("click", async () => {
      try {
        const btn = $("#preview-fix-btn");
        const originalText = btn.textContent;
        btn.textContent = "⏳ Injecting...";
        
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && issue.css_selector) {
          const injection = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (selector, html) => {
              const el = document.querySelector(selector);
              if (el) {
                // Parse the AI's HTML snippet safely out-of-DOM
                const temp = document.createElement('div');
                temp.innerHTML = html.trim();
                const newEl = temp.firstElementChild;
                if (!newEl) return false;
                
                // DYNAMIC ATTRIBUTE MERGE (Strictly non-destructive)
                Array.from(newEl.attributes).forEach(attr => {
                  el.setAttribute(attr.name, attr.value);
                });

                
                return true;
              }
              return false;
            },
            args: [issue.css_selector, data.corrected_html]
          });
          
          if (injection[0].result) {
            btn.textContent = "✅ Injected!";
            btn.style.background = "var(--green)";
            resolvedSelectors.add(issue.css_selector);
            
            // Immediately remove highlight from this specific element if it exists
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (selector) => {
                try {
                  document.querySelectorAll(selector).forEach(el => {
                    el.classList.remove("accessiscan-highlight");
                    el.removeAttribute("data-accessi-num");
                  });
                } catch (e) {}
              },
              args: [issue.css_selector]
            });
          } else {
            btn.textContent = "❌ Element not found";
            btn.style.background = "var(--red)";
          }
          
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = "var(--blue)";
          }, 3000);
        }
      } catch (err) {
        console.error("Preview failed:", err);
      }
    });

    $("#copy-fix-btn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(data.corrected_html).then(() => {
        const copyBtn = $("#copy-fix-btn");
        copyBtn.textContent = "✅ Copied!";
        setTimeout(() => (copyBtn.textContent = "📋 Copy HTML"), 1500);
      });
    });
  } catch (err) {
    modalBody.innerHTML = `
      <div class="error-card">
        <span class="error-icon">⚠️</span>
        <p class="error-msg">${escHtml(err.message)}</p>
      </div>`;
  }
}

modalClose.addEventListener("click", () => modalOverlay.classList.add("hidden"));
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add("hidden");
});

// ─── Error Panel ───────────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  showPanel(errorPanel);
}

// ─── Utilities ─────────────────────────────────────────────────────
function escHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function impactIcon(impact) {
  switch (impact) {
    case "critical": return "🔴";
    case "serious":  return "🟠";
    case "moderate": return "🟡";
    case "minor":    return "🟢";
    default:         return "⚪";
  }
}

