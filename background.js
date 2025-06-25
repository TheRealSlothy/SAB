let savedAdTimestamp = 0;
let restoreAfterAd = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "saveAdData") {
    if (typeof message.savedAdTimestamp === 'number' && message.savedAdTimestamp > 2) {
      savedAdTimestamp = message.savedAdTimestamp;
      restoreAfterAd = true;
      console.log("Saved timestamp:", savedAdTimestamp);
    } else {
      console.warn("Ignored invalid timestamp:", message.savedAdTimestamp);
    }
  } else if (message.action === "getAdData") {
    console.log("Sending saved timestamp:", savedAdTimestamp);
    sendResponse({
      savedAdTimestamp,
      restoreAfterAd
    });
    restoreAfterAd = false; // Reset after use
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;

      const tabId = tabs[0].id;
      if (message.action === "muteTab") {
        chrome.tabs.update(tabId, { muted: true });
      } else if (message.action === "unmuteTab") {
        chrome.tabs.update(tabId, { muted: false });
      } else if (message.action === "reloadTab") {
        chrome.tabs.reload(tabId);
      }
    });
  }

  return true; // Keep message channel open for async sendResponse
});