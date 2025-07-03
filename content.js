console.log("SAB Has loaded");

let adMuteActive = false;
let lastSafeTime = 0;
let justLoaded = true;

const MIN_SAFE_TIME = 2;
const CHECK_INTERVAL = 500;

function isAdPlaying() {
  const player = document.querySelector('.html5-video-player');
  return player?.classList.contains('ad-showing') || false;
}

setInterval(() => {
  const video = document.querySelector('video');
  if (!video) return;

  const adIsPlaying = isAdPlaying();
  const currentTime = video.currentTime;

  if (adIsPlaying) {
    if (!adMuteActive) {
      adMuteActive = true;
      chrome.runtime.sendMessage({ action: "muteTab" });

      const wasPreRoll = currentTime <= MIN_SAFE_TIME;
      const savedTime = wasPreRoll ? 0 : lastSafeTime;

      chrome.runtime.sendMessage({
        action: "saveAdData",
        savedTime,
        wasPreRoll
      });

      chrome.runtime.sendMessage({ action: "reloadTab" });
    }
  } else {
    if (!isNaN(currentTime) && currentTime > MIN_SAFE_TIME) {
      lastSafeTime = currentTime;
    }
  }
}, CHECK_INTERVAL);

// Handle restore on reload
chrome.runtime.sendMessage({ action: "getAdData" }, (data) => {
  if (!data || !data.restoreAfterAd) return;

  const { savedAdTimestamp, wasPreRoll } = data;

  const videoCheck = setInterval(() => {
    const video = document.querySelector('video');
    if (!video || video.readyState < 2 || video.seekable.length === 0) return;

    clearInterval(videoCheck);

    if (!wasPreRoll && savedAdTimestamp > MIN_SAFE_TIME) {
      // Mid-roll: seek and unmute
      video.currentTime = savedAdTimestamp;
      console.log("Restored to", savedAdTimestamp);
    }

    // Unmute in both cases
    chrome.runtime.sendMessage({ action: "unmuteTab" });
    adMuteActive = false;
    justLoaded = false;
  }, 300);
});
