let currentDomain = null;
let lastActiveTimestamp = Date.now();
let isUserActive = true;

// Helper: Extract root hostname cleanly (e.g., "docs.google.com" or "github.com")
function getDomainFromUrl(url) {
  try {
    if (
      !url ||
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://")
    ) {
      return null;
    }
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

// Commit active seconds to storage for the outgoing domain
async function commitTimeChunk() {
  const now = Date.now();
  const elapsedSeconds = Math.round((now - lastActiveTimestamp) / 1000);

  if (currentDomain && elapsedSeconds > 0 && isUserActive) {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
    const storageKey = `analytics_${today}`;

    const data = await chrome.storage.local.get({ [storageKey]: {} });
    const dayRecords = data[storageKey];

    dayRecords[currentDomain] =
      (dayRecords[currentDomain] || 0) + elapsedSeconds;

    await chrome.storage.local.set({ [storageKey]: dayRecords });
  }

  lastActiveTimestamp = now;
}

//  Track when user switches to a different tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await commitTimeChunk();

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    currentDomain = getDomainFromUrl(tab.url);
  } catch (err) {
    currentDomain = null;
  }
});

// Track when a tab navigates to a new URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    await commitTimeChunk();
    currentDomain = getDomainFromUrl(changeInfo.url);
  }
});

//  Track when browser window loses focus (e.g. user alt-tabs to a local desktop app)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await commitTimeChunk();

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus completely
    currentDomain = null;
  } else {
    // Regained focus: get the current active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    currentDomain = tab ? getDomainFromUrl(tab.url) : null;
  }
});

// Idle Detection: Stop tracking if user walks away from keyboard
chrome.idle.setDetectionInterval(60); // 60 seconds threshold

chrome.idle.onStateChanged.addListener(async (newState) => {
  await commitTimeChunk();

  if (newState === "active") {
    isUserActive = true;
  } else {
    // "idle" or "locked"
    isUserActive = false;
    currentDomain = null;
  }
});

// Setup an alarm every 5 minutes to push data (Future Backend Sync hook)
chrome.alarms.create("syncWithDashboard", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "syncWithDashboard") {
    await commitTimeChunk();

    // In Phase 2: POST payload to your Node.js/Postgres API
    console.log("Heartbeat: Ready to sync with backend dashboard");
  }
});
