(function() {
    // Check if we're on YouTube
    if (!window.location.hostname.includes('youtube.com')) return;
    
    // Variables to track state
    let originalVolume = 1;
    let currentVideo = null;
    let adPlaying = false;
    let adSimulationInProgress = false;
    let settings = {
        simDuration: 1000,
        networkDelay: 300,
        volumeFix: true
    };
    
    // Get settings from background
    chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
        if (response) {
            settings = response;
        }
    });
    
    // MutationObserver to detect video element changes
    const observer = new MutationObserver((mutations) => {
        if (!currentVideo || !document.contains(currentVideo)) {
            findVideoElement();
        }
    });
    
    observer.observe(document, {
        childList: true,
        subtree: true
    });
    
    // Find the video element
    function findVideoElement() {
        currentVideo = document.querySelector('video');
        if (currentVideo) {
            setupVideoListeners();
        }
    }
    
    // Setup video event listeners
    function setupVideoListeners() {
        currentVideo.addEventListener('volumechange', () => {
            if (!adPlaying) {
                originalVolume = currentVideo.volume;
            }
        });
        
        currentVideo.addEventListener('play', () => {
            checkForAd();
        });
    }
    
    // Check if an ad is playing
    function checkForAd() {
        chrome.runtime.sendMessage({ type: 'isEnabled' }, (response) => {
            if (!response || !response.globalEnabled || !response.hostEnabled) return;
            
            // Check for common ad indicators
            const adOverlay = document.querySelector('.ytp-ad-player-overlay');
            const adSkipButton = document.querySelector('.ytp-ad-skip-button');
            const adModule = document.querySelector('.video-ads');
            
            if (adOverlay || adSkipButton || adModule) {
                handleAdStart();
            }
        });
    }
    
    // Handle when an ad starts
    function handleAdStart() {
        if (adPlaying || adSimulationInProgress) return;
        
        adPlaying = true;
        originalVolume = currentVideo.volume;
        
        // Simulate ad viewing
        simulateAdViewing();
    }
    
    // Simulate that the ad is being viewed
    function simulateAdViewing() {
        adSimulationInProgress = true;
        
        // 1. Let the ad play for a short time (configurable)
        setTimeout(() => {
            // 2. Skip the ad quietly
            skipAd();
            
            // 3. Report to YouTube that the ad completed
            reportAdCompletion();
            
            adSimulationInProgress = false;
        }, settings.simDuration);
    }
    
    // Skip the ad without detection
    function skipAd() {
        try {
            // Try to find and click the skip button if available
            const skipButton = document.querySelector('.ytp-ad-skip-button');
            if (skipButton) {
                skipButton.click();
            } else {
                // If no skip button, just seek to end of ad
                currentVideo.currentTime = currentVideo.duration;
            }
            
            // Restore original volume if setting is enabled
            if (settings.volumeFix) {
                currentVideo.volume = originalVolume;
            }
            
            // Report ad skipped
            chrome.runtime.sendMessage({ type: 'adSkipped' });
            
            adPlaying = false;
        } catch (e) {
            console.error('Workaround: Error skipping ad', e);
        }
    }
    
    // Report to YouTube that the ad completed
    function reportAdCompletion() {
        try {
            // Find YouTube's internal ad tracking objects
            const yt = window.yt || {};
            const ytcfg = yt.config_ || {};
            
            // Simulate ad completion events
            if (ytcfg.AD_COMPLETED) {
                ytcfg.AD_COMPLETED();
            }
            
            // Find and trigger any ad tracking pixels
            const adPixels = document.querySelectorAll('img[src*="doubleclick.net"]');
            adPixels.forEach(pixel => {
                const fakePixel = new Image();
                fakePixel.src = pixel.src;
            });
            
            // Simulate network requests
            simulateNetworkRequests();
        } catch (e) {
            console.error('Workaround: Error reporting ad completion', e);
        }
    }
    
    // Simulate expected network requests
    function simulateNetworkRequests() {
        setTimeout(() => {
            // Simulate delayed ad beacon requests
            const fakeBeacon = new Image();
            fakeBeacon.src = `https://www.google.com/ads/measurement/l?ebcid=ADBv${Math.random().toString(36).substring(2, 15)}`;
            
            // Simulate other expected requests
            fetch(`https://www.youtube.com/api/stats/ads?event=2&device=1&ad_type=${Math.floor(Math.random() * 5) + 1}`, {
                mode: 'no-cors',
                credentials: 'include'
            }).catch(() => {});
        }, settings.networkDelay);
    }
    
    // Proxy some YouTube internal functions to hide our activity
    function proxyYouTubeFunctions() {
        const yt = window.yt || (window.yt = {});
        const originalPush = yt.push || function() {};
        
        yt.push = function() {
            const args = Array.from(arguments);
            
            // Filter out any ad-related events we don't want to send
            if (args.length > 0 && typeof args[0] === 'string' && 
                (args[0].includes('ad') || args[0].includes('Ad') || args[0].includes('AD'))) {
                return;
            }
            
            return originalPush.apply(this, args);
        };
    }
    
    // Initialize
    proxyYouTubeFunctions();
    findVideoElement();
    
    // Periodically check for ads in case we miss the initial detection
    setInterval(checkForAd, 2000);
})();
