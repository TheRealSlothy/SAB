console.log("SAB Has loaded");

const CHECK_INTERVAL = 500;
const MAX_RELOAD_ATTEMPTS = 3;
const GRACE_PERIOD_MS = 5000;

let lastSafeTime = null;
let adActive = false;
let currentVideoId = null;
let reloadAttempts = 0;
let adStartTime = 0; // Tracks when an ad starts for grace period
let isTimeLoaded = false; // Tracks if stored time has been loaded

// Debug logging function
function debugLog(message) {
    chrome.storage.local.get(['debugMode'], (data) => {
        if (data.debugMode) {
            console.log(`[SAB DEBUG] ${message}`);
        }
    });
}

function getVideoIdFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const videoId = params.get('v');
        debugLog(`Extracted video ID: ${videoId}`);
        return videoId;
    } catch (e) {
        console.error("[SAB] Error getting video ID:", e);
        debugLog(`Error getting video ID: ${e.message}`);
        return null;
    }
}

function getTimeFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('t');
        const time = t ? parseFloat(t) : null;
        debugLog(`URL time parameter: ${time}`);
        return time;
    } catch (e) {
        console.error("[SAB] Error getting time from URL:", e);
        debugLog(`Error getting time from URL: ${e.message}`);
        return null;
    }
}

function setTimeInUrl(time) {
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('t', Math.floor(time));
        const newUrl = url.toString();
        debugLog(`Set URL time to ${Math.floor(time)}: ${newUrl}`);
        return newUrl;
    } catch (e) {
        console.error("[SAB] Error setting time in URL:", e);
        debugLog(`Error setting time in URL: ${e.message}`);
        return window.location.href;
    }
}

function isAdPlaying() {
    try {
        const player = document.querySelector('.html5-video-player');
        const adOverlay = document.querySelector('.ytp-ad-player-overlay');
        const isAd = player?.classList.contains('ad-showing') || adOverlay !== null;
        debugLog(`Ad playing check: ${isAd}`);
        return isAd;
    } catch (e) {
        console.error("[SAB] Error checking ad status:", e);
        debugLog(`Error checking ad status: ${e.message}`);
        return false;
    }
}

function seekVideoToTime(video, time) {
    try {
        if (video.readyState >= 2 && video.seekable.length > 0) {
            if (Math.abs(video.currentTime - time) > 1) {
                video.currentTime = time;
                debugLog(`Seeking video to ${time}s, currentTime: ${video.currentTime}`);
            }
            return true;
        }
        debugLog(`Video not ready for seeking: readyState=${video.readyState}, seekable.length=${video.seekable.length}`);
        return false;
    } catch (e) {
        console.error("[SAB] Error seeking video:", e);
        debugLog(`Error seeking video: ${e.message}`);
        return false;
    }
}

function muteTab() {
    chrome.runtime.sendMessage({ type: 'MUTE_TAB' }, (response) => {
        debugLog(`Mute tab response: ${response.status}, adActive: ${adActive}`);
    });
}

function unmuteTab() {
    chrome.runtime.sendMessage({ type: 'UNMUTE_TAB' }, (response) => {
        debugLog(`Unmute tab response: ${response.status}, adActive: ${adActive}`);
    });
}

function reloadWithTime(time) {
    if (reloadAttempts >= MAX_RELOAD_ATTEMPTS) {
        debugLog(`Max reload attempts reached: ${reloadAttempts}`);
        unmuteTab();
        return;
    }

    reloadAttempts++;
    const newUrl = setTimeInUrl(time);
    debugLog(`Reload attempt ${reloadAttempts}/${MAX_RELOAD_ATTEMPTS} with time: ${time}`);
    muteTab();
    window.location.href = newUrl;
}

function saveLastSafeTime(videoId, time) {
    if (!videoId || time === null) return;
    chrome.storage.local.set({ [`lastSafeTime_${videoId}`]: time }, () => {
        debugLog(`Saved lastSafeTime for video ${videoId}: ${time}`);
    });
}

function loadLastSafeTime(videoId, callback) {
    if (!videoId) {
        debugLog("No video ID, returning default time 0");
        return callback(0);
    }
    chrome.storage.local.get([`lastSafeTime_${videoId}`], (result) => {
        const time = result[`lastSafeTime_${videoId}`] || 0;
        debugLog(`Loaded lastSafeTime for video ${videoId}: ${time}`);
        callback(time);
    });
}

setInterval(() => {
    const video = document.querySelector('video');
    if (!video) {
        debugLog("No video element found");
        return;
    }

    const videoId = getVideoIdFromUrl();
    if (!videoId) {
        debugLog("No video ID found in URL");
        return;
    }

    if (videoId !== currentVideoId) {
        debugLog(`Video ID changed from ${currentVideoId} to ${videoId}, resetting lastSafeTime`);
        currentVideoId = videoId;
        lastSafeTime = null; // Reset lastSafeTime for new video
        reloadAttempts = 0;
        adStartTime = 0; // Reset grace period for new video
        adActive = false; // Reset adActive to prevent premature ad handling
        isTimeLoaded = false;
        // Load stored time immediately
        loadLastSafeTime(videoId, (time) => {
            lastSafeTime = time;
            isTimeLoaded = true;
            debugLog(`Loaded last safe time for video ${videoId}: ${lastSafeTime}`);
        });
        return; // Skip further processing until next interval
    }

    const adPlaying = isAdPlaying();
    const currentTime = video.currentTime;
    const isGracePeriodActive = adStartTime > 0 && Date.now() - adStartTime < GRACE_PERIOD_MS;

    if (adPlaying && !adActive && isTimeLoaded && lastSafeTime !== null) {
        adActive = true;
        adStartTime = Date.now(); // Start grace period when ad begins
        debugLog(`Ad detected, currentTime: ${currentTime}, reloading to lastSafeTime: ${lastSafeTime}`);
        reloadWithTime(lastSafeTime);
    } else if (!adPlaying && adActive) {
        adActive = false;
        reloadAttempts = 0;
        adStartTime = 0; // Reset grace period when ad ends
        unmuteTab();
        debugLog("Ad ended, resuming normal playback");
    }

    if (!adPlaying && !isNaN(currentTime) && !isGracePeriodActive) {
        lastSafeTime = currentTime; // Update lastSafeTime to current position
        saveLastSafeTime(videoId, lastSafeTime);
        debugLog(`Updated lastSafeTime to currentTime: ${currentTime}`);
    }
}, CHECK_INTERVAL);

window.addEventListener('load', () => {
    debugLog("Page load event triggered");
    const videoId = getVideoIdFromUrl();
    if (videoId && videoId !== currentVideoId) {
        debugLog(`Load event: Video ID changed from ${currentVideoId} to ${videoId}, resetting lastSafeTime`);
        currentVideoId = videoId;
        lastSafeTime = null; // Reset lastSafeTime for new video
        reloadAttempts = 0;
        adStartTime = 0; // Reset grace period
        adActive = false; // Reset adActive
        isTimeLoaded = false;
        // Load stored time immediately
        loadLastSafeTime(videoId, (time) => {
            lastSafeTime = time;
            isTimeLoaded = true;
            debugLog(`Loaded last safe time for video ${videoId}: ${lastSafeTime}`);
        });
    }

    const timeToRestore = getTimeFromUrl();
    if (timeToRestore === null || videoId !== currentVideoId) {
        debugLog(`No time to restore or video ID changed, checking ad state`);
        // Check ad state and unmute if no ad is playing
        if (!isAdPlaying()) {
            unmuteTab();
            debugLog("No ad playing on page load, unmuting tab");
        }
        return;
    }

    debugLog(`Restoring time from URL: ${timeToRestore}`);
    const tryRestoreInterval = setInterval(() => {
        const video = document.querySelector('video');
        if (video && seekVideoToTime(video, timeToRestore)) {
            clearInterval(tryRestoreInterval);
            unmuteTab();
            debugLog("Time restored, unmuting tab");
            // Clean URL
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search.replace(/([?&])t=\d+(&|$)/, (match, p1, p2) => {
                    return p1 === '?' && p2 ? '?' : p2 ? '&' : '';
                }));
                debugLog("URL cleaned after time restoration");
            } catch (e) {
                console.error("[SAB] Error cleaning URL:", e);
                debugLog(`Error cleaning URL: ${e.message}`);
            }
        }
    }, 300);
});
