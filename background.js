chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'MUTE_TAB') {
        chrome.tabs.update(sender.tab.id, { muted: true });
        sendResponse({ status: 'muted' });
    } else if (message.type === 'UNMUTE_TAB') {
        chrome.tabs.update(sender.tab.id, { muted: false });
        sendResponse({ status: 'unmuted' });
    }
    return true; // Keep message channel open for async response
});

// Clean up storage when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(`lastSafeTime_${tabId}`, () => {
        console.log(`[AdBlock] Cleaned storage for tab ${tabId}`);
    });
});
