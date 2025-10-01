// Chrome Time Tracker - Background Script
let currentUrl = '';
let startTime = 0;
let isTracking = true;
let autoResumeTimeoutId = null;

// Data retention constants - keep current month + 2 previous months
const DATA_RETENTION_MONTHS = 3;
const CLEANUP_INTERVAL_HOURS = 6; // Run cleanup every 6 hours

// Initialize on startup and install
chrome.runtime.onStartup.addListener(() => {
    console.log('🚀 Background: Extension startup');
    initializeExtension();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 Background: Extension installed');
    initializeExtension();
});

async function initializeExtension() {
    // Initialize tracking state
    const result = await chrome.storage.local.get(['isTracking']);
    isTracking = result.isTracking !== false;

    // Check for existing auto-resume timer
    checkForExistingTimer();

    // Start automatic cleanup cycle
    startAutomaticCleanup();

    console.log('✅ Background: Extension initialized');
}

// Handle extension icon clicks - open welcome page in new tab
chrome.action.onClicked.addListener((tab) => {
    console.log('🎯 Extension icon clicked');

    // Open the welcome page in a new tab
    chrome.tabs.create({
        url: chrome.runtime.getURL('pages/welcome.html')
    });
});

// Automatic cleanup management
function startAutomaticCleanup() {
    console.log('🧹 Background: Starting automatic cleanup cycle');

    // Run cleanup immediately on startup
    performDataCleanup();

    // Set up periodic cleanup every 6 hours
    setInterval(() => {
        console.log('🧹 Background: Running scheduled cleanup');
        performDataCleanup();
    }, CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
}

// Tab and URL tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (!isTracking) return;

    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        handleUrlChange(tab.url);
    } catch (error) {
        console.error('❌ Background: Error getting active tab:', error);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!isTracking) return;

    if (changeInfo.status === 'complete' && tab.active && tab.url) {
        handleUrlChange(tab.url);
    }
});

function handleUrlChange(url) {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return;
    }

    const now = Date.now();

    // Save time for previous URL
    if (currentUrl && startTime > 0) {
        const timeSpent = now - startTime;
        saveTimeData(currentUrl, timeSpent);
    }

    // Start tracking new URL
    currentUrl = url;
    startTime = now;

    console.log('📊 Background: Tracking URL:', url);
}

async function saveTimeData(url, timeMs) {
    try {
        const today = getLocalDateString(new Date());
        const key = `data_${today}`;

        const result = await chrome.storage.local.get([key]);
        const data = result[key] || {};

        data[url] = (data[url] || 0) + timeMs;

        await chrome.storage.local.set({ [key]: data });

        console.log(`💾 Background: Saved ${timeMs}ms for ${url}`);
    } catch (error) {
        console.error('❌ Background: Error saving time data:', error);
    }
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📡 Background: Received message:', message);

    if (message.action === 'getTrackingState') {
        getTrackingState().then(state => sendResponse(state));
        return true;
    } else if (message.action === 'enableTracking') {
        enableTracking().then(result => sendResponse(result));
        return true;
    } else if (message.action === 'disableTracking') {
        disableTracking(message.autoResumeMinutes).then(result => sendResponse(result));
        return true;
    } else if (message.action === 'startAutoResumeTimer') {
        startBackgroundAutoResumeTimer(message.endTime);
        sendResponse({ success: true });
        return false;
    } else if (message.action === 'cancelAutoResumeTimer') {
        cancelBackgroundAutoResumeTimer();
        sendResponse({ success: true });
        return false;
    }

    return false;
});

// Tracking state management
async function getTrackingState() {
    try {
        const result = await chrome.storage.local.get(['isTracking']);
        const trackingState = result.isTracking !== false;
        return { isTracking: trackingState };
    } catch (error) {
        console.error('❌ Background: Error getting tracking state:', error);
        return { isTracking: false };
    }
}

async function enableTracking() {
    try {
        isTracking = true;
        await chrome.storage.local.set({ isTracking: true });

        // Start tracking current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url) {
            handleUrlChange(tabs[0].url);
        }

        console.log('✅ Background: Tracking enabled');
        return { success: true };
    } catch (error) {
        console.error('❌ Background: Error enabling tracking:', error);
        return { success: false, error: error.message };
    }
}

async function disableTracking(autoResumeMinutes = 0) {
    try {
        // Save current session before disabling
        if (currentUrl && startTime > 0) {
            const timeSpent = Date.now() - startTime;
            await saveTimeData(currentUrl, timeSpent);
        }

        isTracking = false;
        currentUrl = '';
        startTime = 0;

        await chrome.storage.local.set({ isTracking: false });

        console.log(`⏸️ Background: Tracking disabled${autoResumeMinutes ? ` with ${autoResumeMinutes} minute auto-resume` : ''}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Background: Error disabling tracking:', error);
        return { success: false, error: error.message };
    }
}

// Auto-resume timer functions
function startBackgroundAutoResumeTimer(endTime) {
    console.log('⏰ Background: Starting auto-resume timer');

    if (autoResumeTimeoutId) {
        clearTimeout(autoResumeTimeoutId);
    }

    const delay = endTime - Date.now();

    if (delay <= 0) {
        executeAutoResume();
        return;
    }

    autoResumeTimeoutId = setTimeout(() => {
        executeAutoResume();
    }, delay);

    console.log(`⏰ Background: Timer set for ${Math.floor(delay / 1000)} seconds`);
}

function cancelBackgroundAutoResumeTimer() {
    console.log('🚫 Background: Cancelling auto-resume timer');

    if (autoResumeTimeoutId) {
        clearTimeout(autoResumeTimeoutId);
        autoResumeTimeoutId = null;
    }
}

async function executeAutoResume() {
    console.log('✅ Background: Executing auto-resume');

    try {
        await enableTracking();
        await chrome.storage.local.remove(['autoResumeTimer']);
        autoResumeTimeoutId = null;

        chrome.notifications.create({
            type: 'basic',
            iconUrl: '../icons/icon48.png',
            title: 'Chrome Time Tracker',
            message: 'Tracking has been automatically resumed!'
        });

        console.log('✅ Background: Auto-resume completed successfully');

    } catch (error) {
        console.error('❌ Background: Error during auto-resume:', error);
    }
}

async function checkForExistingTimer() {
    try {
        const result = await chrome.storage.local.get(['autoResumeTimer']);
        const timerData = result.autoResumeTimer;

        if (timerData && timerData.active) {
            const remaining = timerData.endTime - Date.now();

            if (remaining > 0) {
                console.log('⏰ Background: Restored existing timer with', Math.floor(remaining / 1000), 'seconds remaining');
                startBackgroundAutoResumeTimer(timerData.endTime);
            } else {
                console.log('⏰ Background: Existing timer expired, executing auto-resume');
                executeAutoResume();
            }
        }
    } catch (error) {
        console.error('❌ Background: Error checking for existing timer:', error);
    }
}

// Data cleanup functions
async function performDataCleanup() {
    try {
        console.log('🧹 Background: Starting automatic data cleanup...');

        // Get all storage data
        const allData = await chrome.storage.local.get(null);

        // Calculate cutoff date - start of the month that is 3 months ago
        // This keeps current month + 2 previous months = 3 months total
        const currentDate = new Date();
        const cutoffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - DATA_RETENTION_MONTHS, 1);
        const cutoffDateStr = getLocalDateString(cutoffDate);

        console.log(`🧹 Background: Cleaning data older than ${cutoffDateStr} (keeping current + 2 previous months)`);

        // Find data keys to remove
        const dataKeysToRemove = [];

        Object.keys(allData).forEach(key => {
            if (key.startsWith('data_')) {
                const dateStr = key.replace('data_', '');

                // Validate date format (YYYY-MM-DD)
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    if (dateStr < cutoffDateStr) {
                        dataKeysToRemove.push(key);
                        console.log(`🗑️ Background: Marking for removal: ${key} (${dateStr})`);
                    }
                }
            }
        });

        // Remove old data
        if (dataKeysToRemove.length > 0) {
            await chrome.storage.local.remove(dataKeysToRemove);

            console.log(`✅ Background: Automatic cleanup completed - removed ${dataKeysToRemove.length} old data entries`);

            // Store cleanup stats for potential debugging
            await chrome.storage.local.set({
                lastAutomaticCleanup: {
                    timestamp: Date.now(),
                    removedEntries: dataKeysToRemove.length,
                    cutoffDate: cutoffDateStr
                }
            });

        } else {
            console.log('✅ Background: No old data found to clean up');

            // Still update last cleanup timestamp
            await chrome.storage.local.set({
                lastAutomaticCleanup: {
                    timestamp: Date.now(),
                    removedEntries: 0,
                    cutoffDate: cutoffDateStr
                }
            });
        }

        return { success: true, removedEntries: dataKeysToRemove.length };

    } catch (error) {
        console.error('❌ Background: Error during automatic cleanup:', error);
        return { success: false, error: error.message };
    }
}
