// === Constants ===
const MIN_SAFE_TIME = 2;
const DEFAULT_RESUME_TIME = 8;
const AD_CHECK_INTERVAL = 500;
const MAX_RETRY_SEEK = 2;

// === Variables ===
let adMuteActive = false;
let lastSafeTime = 0;
let firstLoadHandled = false;

console.log("YouTube Ad Skip Extension loaded");

// === Helper: Check if an ad is playing ===
function isAdPlaying() {
  const player = document.querySelector('.html5-video-player');
  if (!player) {
    console.log("Player not found.");
    return false;
  }
  const adPlaying = player.classList.contains('ad-showing');
  console.log(`isAdPlaying(): ${adPlaying}`);
  return adPlaying;
}

// === Interval: Monitor for ads and act ===
setInterval(() => {
  const video = document.querySelector('video');
  if (!video) return;

  const currentTime = video.currentTime;
  const adIsPlaying = isAdPlaying();

  // === Auto-click "Skip Ad" button if visible ===
  const skipBtn = document.querySelector('.ytp-ad-skip-button.ytp-button');
  if (skipBtn) {
    console.log("Auto-clicking skip ad button.");
    skipBtn.click();
  }

  // === Normal playback (update lastSafeTime) ===
  if (!adIsPlaying) {
    if (adMuteActive) {
      adMuteActive = false;
      console.log("Ad ended, resetting mute state.");
    }

    if (!isNaN(currentTime) && video.duration > 30) {
      lastSafeTime = currentTime;
      console.log("Updated last safe time:", lastSafeTime.toFixed(2));
    }

    return;
  }

  // === Pre-roll ad handling ===
  if (!firstLoadHandled && adIsPlaying && lastSafeTime <= MIN_SAFE_TIME) {
    console.warn("Pre-roll ad detected. Forcing reload after mute.");
    chrome.runtime.sendMessage({ action: "muteTab" });
    chrome.runtime.sendMessage({
      action: "saveAdData",
      savedAdTimestamp: DEFAULT_RESUME_TIME
    });
    chrome.runtime.sendMessage({ action: "reloadTab" });

    adMuteActive = true;
    firstLoadHandled = true;
    return;
  }

  // === Mid-roll ad handling ===
  if (adIsPlaying && !adMuteActive && lastSafeTime > MIN_SAFE_TIME) {
    console.log(`Ad detected at ${currentTime.toFixed(2)}s. Saving ${lastSafeTime.toFixed(2)}s and reloading...`);

    chrome.runtime.sendMessage({ action: "muteTab" });
    chrome.runtime.sendMessage({
      action: "saveAdData",
      savedAdTimestamp: lastSafeTime
    });
    chrome.runtime.sendMessage({ action: "reloadTab" });

    adMuteActive = true;
  }
}, AD_CHECK_INTERVAL);

// === On Reload: Restore Timestamp ===
chrome.runtime.sendMessage({ action: "getAdData" }, (data) => {
  console.log("Got ad data from background:", data);

  if (data && data.restoreAfterAd && data.savedAdTimestamp > MIN_SAFE_TIME) {
    const savedTime = data.savedAdTimestamp;
    console.log(`Preparing to restore to ${savedTime.toFixed(2)}s...`);

    const waitForVideo = setInterval(() => {
      const video = document.querySelector('video');

      if (video && video.readyState >= 2 && video.seekable.length > 0) {
        clearInterval(waitForVideo);

        let retry = 0;

        const trySetTime = () => {
          if (video.currentTime < savedTime - 1) {
            video.currentTime = savedTime;
            console.log(`Seek attempt ${retry + 1} to ${savedTime.toFixed(2)}s`);
          } else {
            console.log("No need to restore time; video hasn't rewound.");
            chrome.runtime.sendMessage({ action: "unmuteTab" });
            adMuteActive = false;
            return;
          }

          if (++retry < MAX_RETRY_SEEK) {
            setTimeout(trySetTime, 750);
          } else {
            chrome.runtime.sendMessage({ action: "unmuteTab" });
            adMuteActive = false;
            console.log("Unmuted and finished restoring.");
          }
        };

        trySetTime();
      }
    }, 300);
  } else {
    console.log("No valid timestamp to restore.");
  }
});