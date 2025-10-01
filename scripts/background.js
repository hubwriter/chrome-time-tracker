/**
 * Chrome Time Tracker - Background Service Worker
 *
 * This background script serves as the core engine for the Chrome Time Tracker extension.
 * It runs continuously in the background and handles:
 *
 * 1. Website Time Tracking:
 *    - Monitors active tab changes and URL navigation
 *    - Records time spent on each website in Chrome local storage
 *    - Excludes Chrome internal pages and extension pages
 *    - Filters out page visits shorter than 3 seconds
 *    - Normalizes URLs by removing query parameters
 *
 * 2. Tracking State Management:
 *    - Maintains global tracking enabled/disabled state
 *    - Handles enable/disable requests from the UI
 *    - Persists tracking state across browser sessions
 *
 * 3. Auto-Resume Timer System:
 *    - Manages automatic tracking resumption after temporary pauses
 *    - Coordinates with UI countdown timers
 *    - Sends notifications when tracking resumes automatically
 *
 * 4. Automatic Data Cleanup:
 *    - Runs periodic cleanup every 6 hours to remove old data
 *    - Maintains 3 months of data (current month + 2 previous months)
 *    - Operates transparently without user intervention
 *
 * 5. Extension Lifecycle:
 *    - Handles extension installation and startup
 *    - Opens welcome page when extension icon is clicked
 *    - Manages message passing between UI and background contexts
 *
 * Data Storage Structure:
 * - `data_YYYY-MM-DD`: Daily website time data (URL -> milliseconds)
 * - `isTracking`: Boolean tracking state
 * - `autoResumeTimer`: Timer state for auto-resume functionality
 * - `lastAutomaticCleanup`: Metadata about cleanup operations
 * - `showWelcomeOnStartup`: User preference for showing welcome page
 *
 * @author Chrome Time Tracker Team
 * @version 1.0
 */

// ==================== CONSTANTS ====================

const CONFIG = {
    DATA_RETENTION_MONTHS: 3,      // Keep current month + 2 previous months
    CLEANUP_INTERVAL_HOURS: 6,     // Run cleanup every 6 hours
    EXCLUDED_URL_PREFIXES: ['chrome://', 'chrome-extension://'],
    MIN_VISIT_DURATION_MS: 3000    // Minimum 3 seconds to record a visit
};

// ==================== STATE MANAGEMENT ====================

class TrackingState {
    constructor() {
        this.currentUrl = '';
        this.startTime = 0;
        this.isTracking = true;
        this.autoResumeTimeoutId = null;
    }

    reset() {
        this.currentUrl = '';
        this.startTime = 0;
    }

    setCurrentSession(url, startTime) {
        this.currentUrl = url;
        this.startTime = startTime;
    }

    getCurrentSession() {
        return {
            url: this.currentUrl,
            startTime: this.startTime,
            duration: this.startTime > 0 ? Date.now() - this.startTime : 0
        };
    }

    isValidUrl(url) {
        if (!url) return false;
        return !CONFIG.EXCLUDED_URL_PREFIXES.some(prefix => url.startsWith(prefix));
    }

    isValidDuration(durationMs) {
        return durationMs >= CONFIG.MIN_VISIT_DURATION_MS;
    }

    normalizeUrl(url) {
        if (!url) return url;

        try {
            const urlObj = new URL(url);
            // Return URL without query parameters or fragments
            return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        } catch (error) {
            console.warn('⚠️ Background: Failed to parse URL, using original:', url);
            return url;
        }
    }
}

const trackingState = new TrackingState();

// ==================== EXTENSION LIFECYCLE ====================

chrome.runtime.onStartup.addListener(() => {
    console.log('🚀 Background: Extension startup');
    initializeExtension();
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 Background: Extension installed');
    initializeExtension();
});

chrome.action.onClicked.addListener(async () => {
    console.log('🎯 Extension icon clicked');

    try {
        // Check user preference for showing welcome page
        const result = await chrome.storage.local.get(['showWelcomeOnStartup']);
        const showWelcome = result.showWelcomeOnStartup !== false; // Default to true

        const targetPage = showWelcome ? 'pages/welcome.html' : 'pages/statistics.html';

        chrome.tabs.create({
            url: chrome.runtime.getURL(targetPage)
        });

        console.log(`📖 Opening ${showWelcome ? 'welcome' : 'statistics'} page`);
    } catch (error) {
        console.error('❌ Error checking welcome preference, defaulting to welcome page:', error);
        // Fallback to welcome page if there's an error
        chrome.tabs.create({
            url: chrome.runtime.getURL('pages/welcome.html')
        });
    }
});

async function initializeExtension() {
    try {
        await loadTrackingState();
        await restoreAutoResumeTimer();
        startAutomaticCleanup();
        console.log('✅ Background: Extension initialized');
    } catch (error) {
        console.error('❌ Background: Initialization failed:', error);
    }
}

// ==================== TRACKING STATE PERSISTENCE ====================

async function loadTrackingState() {
    try {
        const result = await chrome.storage.local.get(['isTracking']);
        trackingState.isTracking = result.isTracking !== false;
        console.log('📡 Background: Tracking state loaded:', trackingState.isTracking);
    } catch (error) {
        console.error('❌ Background: Error loading tracking state:', error);
        trackingState.isTracking = true; // Default to enabled
    }
}

async function saveTrackingState(isTracking) {
    try {
        trackingState.isTracking = isTracking;
        await chrome.storage.local.set({ isTracking });
        console.log('💾 Background: Tracking state saved:', isTracking);
    } catch (error) {
        console.error('❌ Background: Error saving tracking state:', error);
    }
}

// ==================== URL TRACKING ====================

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (!trackingState.isTracking) return;

    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        handleUrlChange(tab.url);
    } catch (error) {
        console.error('❌ Background: Error getting active tab:', error);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!trackingState.isTracking) return;

    if (changeInfo.status === 'complete' && tab.active && tab.url) {
        handleUrlChange(tab.url);
    }
});

function handleUrlChange(rawUrl) {
    if (!trackingState.isValidUrl(rawUrl)) {
        return;
    }

    // Normalize URL by removing query parameters
    const normalizedUrl = trackingState.normalizeUrl(rawUrl);
    const now = Date.now();

    // Save time for previous URL session if it meets minimum duration
    if (trackingState.currentUrl && trackingState.startTime > 0) {
        const session = trackingState.getCurrentSession();

        if (trackingState.isValidDuration(session.duration)) {
            saveTimeData(session.url, session.duration);
        } else {
            console.log(`⏭️ Background: Skipping short visit (${Math.round(session.duration/1000)}s) to ${session.url}`);
        }
    }

    // Start tracking new URL (use normalized URL)
    trackingState.setCurrentSession(normalizedUrl, now);

    // Log both URLs for debugging if they're different
    if (rawUrl !== normalizedUrl) {
        console.log(`📊 Background: Now tracking: ${normalizedUrl} (normalized from ${rawUrl})`);
    } else {
        console.log('📊 Background: Now tracking:', normalizedUrl);
    }
}

async function saveTimeData(url, timeMs) {
    if (timeMs <= 0) return;

    try {
        const today = getLocalDateString(new Date());
        const key = `data_${today}`;

        const result = await chrome.storage.local.get([key]);
        const data = result[key] || {};

        data[url] = (data[url] || 0) + timeMs;

        await chrome.storage.local.set({ [key]: data });
        console.log(`💾 Background: Saved ${Math.round(timeMs/1000)}s for ${url}`);
    } catch (error) {
        console.error('❌ Background: Error saving time data:', error);
    }
}

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📡 Background: Received message:', message.action);

    const handlers = {
        'getTrackingState': handleGetTrackingState,
        'enableTracking': handleEnableTracking,
        'disableTracking': handleDisableTracking,
        'startAutoResumeTimer': handleStartAutoResumeTimer,
        'cancelAutoResumeTimer': handleCancelAutoResumeTimer
    };

    const handler = handlers[message.action];
    if (handler) {
        handler(message, sendResponse);
        return true; // Keep message channel open for async response
    }

    console.warn('⚠️ Background: Unknown message action:', message.action);
    sendResponse({ success: false, error: 'Unknown action' });
    return false;
});

async function handleGetTrackingState(message, sendResponse) {
    try {
        sendResponse({ isTracking: trackingState.isTracking });
    } catch (error) {
        console.error('❌ Background: Error getting tracking state:', error);
        sendResponse({ isTracking: false });
    }
}

async function handleEnableTracking(message, sendResponse) {
    try {
        await saveTrackingState(true);

        // Start tracking current tab if available
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url) {
            handleUrlChange(tabs[0].url);
        }

        console.log('✅ Background: Tracking enabled');
        sendResponse({ success: true });
    } catch (error) {
        console.error('❌ Background: Error enabling tracking:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleDisableTracking(message, sendResponse) {
    try {
        // Save current session before disabling (if it meets minimum duration)
        if (trackingState.currentUrl && trackingState.startTime > 0) {
            const session = trackingState.getCurrentSession();

            if (trackingState.isValidDuration(session.duration)) {
                await saveTimeData(session.url, session.duration);
            } else {
                console.log(`⏭️ Background: Current session too short (${Math.round(session.duration/1000)}s), not saving`);
            }
        }

        await saveTrackingState(false);
        trackingState.reset();

        const autoResumeMinutes = message.autoResumeMinutes || 0;
        console.log(`⏸️ Background: Tracking disabled${autoResumeMinutes ? ` with ${autoResumeMinutes} minute auto-resume` : ''}`);
        sendResponse({ success: true });
    } catch (error) {
        console.error('❌ Background: Error disabling tracking:', error);
        sendResponse({ success: false, error: error.message });
    }
}

function handleStartAutoResumeTimer(message, sendResponse) {
    startBackgroundAutoResumeTimer(message.endTime);
    sendResponse({ success: true });
}

function handleCancelAutoResumeTimer(message, sendResponse) {
    cancelBackgroundAutoResumeTimer();
    sendResponse({ success: true });
}

// ==================== AUTO-RESUME TIMER MANAGEMENT ====================

function startBackgroundAutoResumeTimer(endTime) {
    console.log('⏰ Background: Starting auto-resume timer');

    cancelBackgroundAutoResumeTimer(); // Clear any existing timer

    const delay = endTime - Date.now();

    if (delay <= 0) {
        executeAutoResume();
        return;
    }

    trackingState.autoResumeTimeoutId = setTimeout(() => {
        executeAutoResume();
    }, delay);

    console.log(`⏰ Background: Timer set for ${Math.round(delay / 1000)} seconds`);
}

function cancelBackgroundAutoResumeTimer() {
    if (trackingState.autoResumeTimeoutId) {
        clearTimeout(trackingState.autoResumeTimeoutId);
        trackingState.autoResumeTimeoutId = null;
        console.log('🚫 Background: Auto-resume timer cancelled');
    }
}

async function executeAutoResume() {
    console.log('✅ Background: Executing auto-resume');

    try {
        await saveTrackingState(true);
        await chrome.storage.local.remove(['autoResumeTimer']);
        trackingState.autoResumeTimeoutId = null;

        // Start tracking current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].url) {
            handleUrlChange(tabs[0].url);
        }

        // Notify user
        await showNotification(
            'Chrome Time Tracker',
            'Tracking has been automatically resumed!',
            '../icons/icon48.png'
        );

        console.log('✅ Background: Auto-resume completed successfully');
    } catch (error) {
        console.error('❌ Background: Error during auto-resume:', error);
    }
}

async function restoreAutoResumeTimer() {
    try {
        const result = await chrome.storage.local.get(['autoResumeTimer']);
        const timerData = result.autoResumeTimer;

        if (!timerData?.active) return;

        const remaining = timerData.endTime - Date.now();

        if (remaining > 0) {
            console.log('⏰ Background: Restored existing timer with', Math.round(remaining / 1000), 'seconds remaining');
            startBackgroundAutoResumeTimer(timerData.endTime);
        } else {
            console.log('⏰ Background: Existing timer expired, executing auto-resume');
            executeAutoResume();
        }
    } catch (error) {
        console.error('❌ Background: Error restoring auto-resume timer:', error);
    }
}

// ==================== AUTOMATIC DATA CLEANUP ====================

function startAutomaticCleanup() {
    console.log('🧹 Background: Starting automatic cleanup cycle');

    // Run cleanup immediately on startup
    performDataCleanup();

    // Set up periodic cleanup
    setInterval(() => {
        console.log('🧹 Background: Running scheduled cleanup');
        performDataCleanup();
    }, CONFIG.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
}

async function performDataCleanup() {
    try {
        console.log('🧹 Background: Starting automatic data cleanup...');

        const allData = await chrome.storage.local.get(null);
        const cutoffDate = calculateDataCutoffDate();
        const dataKeysToRemove = findDataKeysToRemove(allData, cutoffDate);

        if (dataKeysToRemove.length > 0) {
            await chrome.storage.local.remove(dataKeysToRemove);
            console.log(`✅ Background: Cleaned up ${dataKeysToRemove.length} old data entries`);
        } else {
            console.log('✅ Background: No old data found to clean up');
        }

        await saveCleanupMetadata(dataKeysToRemove.length, cutoffDate);

        return { success: true, removedEntries: dataKeysToRemove.length };
    } catch (error) {
        console.error('❌ Background: Error during automatic cleanup:', error);
        return { success: false, error: error.message };
    }
}

function calculateDataCutoffDate() {
    const currentDate = new Date();
    const cutoffDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - CONFIG.DATA_RETENTION_MONTHS,
        1
    );
    const cutoffDateStr = getLocalDateString(cutoffDate);

    console.log(`🧹 Background: Cutoff date for cleanup: ${cutoffDateStr} (keeping current + ${CONFIG.DATA_RETENTION_MONTHS-1} previous months)`);
    return cutoffDateStr;
}

function findDataKeysToRemove(allData, cutoffDateStr) {
    const dataKeysToRemove = [];

    Object.keys(allData).forEach(key => {
        if (key.startsWith('data_')) {
            const dateStr = key.replace('data_', '');

            // Validate date format (YYYY-MM-DD) and check if it's before cutoff
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && dateStr < cutoffDateStr) {
                dataKeysToRemove.push(key);
                console.log(`🗑️ Background: Marking for removal: ${key}`);
            }
        }
    });

    return dataKeysToRemove;
}

async function saveCleanupMetadata(removedEntries, cutoffDateStr) {
    try {
        await chrome.storage.local.set({
            lastAutomaticCleanup: {
                timestamp: Date.now(),
                removedEntries: removedEntries,
                cutoffDate: cutoffDateStr
            }
        });
    } catch (error) {
        console.error('❌ Background: Error saving cleanup metadata:', error);
    }
}

// ==================== UTILITY FUNCTIONS ====================

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function showNotification(title, message, iconUrl) {
    try {
        await chrome.notifications.create({
            type: 'basic',
            iconUrl: iconUrl,
            title: title,
            message: message
        });
    } catch (error) {
        console.error('❌ Background: Error showing notification:', error);
    }
}

// ==================== ERROR HANDLING ====================

// Global error handler for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Background: Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

// Global error handler for uncaught exceptions
self.addEventListener('error', (event) => {
    console.error('❌ Background: Uncaught error:', event.error);
});

console.log('🚀 Background: Service worker script loaded');
