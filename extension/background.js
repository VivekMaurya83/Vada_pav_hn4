/**
 * Service worker — handles background events.
 * Currently minimal; the popup handles API calls directly.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("AccessiScan extension installed.");
});

// Allow users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
