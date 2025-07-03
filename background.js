let savedAdTimestamp = 0;
let restoreAfterAd = false;
let wasPreRoll = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.action) {
    case "saveAdData":
      savedAdTimestamp = message.savedTime || 0;
      wasPreRoll = message.wasPreRoll || false;
      restoreAfterAd = true;
      console.log("Saved ad data:", { savedAdTimestamp, wasPreRoll });
      break;

    case "getAdData":
      sendResponse({ savedAdTimestamp, wasPreRoll, restoreAfterAd });
      restoreAfterAd = false;
      break;

    case "muteTab":
      tabId && chrome.tabs.update(tabId, { muted: true });
      break;

    case "unmuteTab":
      tabId && chrome.tabs.update(tabId, { muted: false });
      break;

    case "reloadTab":
      tabId && chrome.tabs.reload(tabId);
      break;
  }

  return true;
});
