const toggle = document.getElementById('toggle1');

// Load debug setting on popup open
chrome.storage.local.get('debugMode', (data) => {
    toggle.checked = !!data.debugMode;
});

// Listen for toggle changes
toggle.addEventListener('change', function () {
    const isDebug = this.checked;
    chrome.storage.local.set({ debugMode: isDebug });
    console.log('Debug Mode:', isDebug);
});
