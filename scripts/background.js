// Chrome Time Tracker - Enhanced Background Script
// Handles automatic time tracking functionality with improved error handling and edge cases

class TimeTracker {
  constructor() {
    this.currentUrl = null;
    this.currentTabId = null;
    this.startTime = null;
    this.isTracking = false;
    this.isChromeActive = true;
    this.focusCheckInterval = null;
    this.lastSaveTime = 0;
    this.pendingData = new Map(); // Buffer for unsaved data
    
    this.init();
  }

  async init() {
    console.log('Chrome Time Tracker: Background script initialized');
    
    // Load tracking state from storage
    await this.loadTrackingState();
    
    // Clean up old data (keep only 3 months)
    await this.cleanupOldData();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start focus detection polling
    this.startFocusDetection();
    
    // Start tracking current tab if tracking is enabled
    if (this.isTracking) {
      await this.startTrackingCurrentTab();
    }
    
    // Check if this is first install
    await this.checkFirstInstall();
    
    // Set up periodic save for safety
    this.setupPeriodicSave();
  }

  setupEventListeners() {
    // Tab change events
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabChange(activeInfo.tabId);
    });

    // Tab update events (URL changes)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        this.handleTabChange(tabId);
      }
    });

    // Window focus events
    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.handleWindowFocusChange(windowId);
    });

    // Extension action click
    chrome.action.onClicked.addListener(() => {
      this.openStatisticsPage();
    });

    // Tab removal (save any pending data)
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === this.currentTabId) {
        this.pauseCurrentTracking();
      }
    });

    // Browser startup/shutdown handling
    chrome.runtime.onStartup.addListener(() => {
      this.handleBrowserStartup();
    });

    chrome.runtime.onSuspend.addListener(() => {
      this.handleBrowserShutdown();
    });
  }

  async loadTrackingState() {
    try {
      const result = await chrome.storage.local.get(['isTracking', 'autoResumeTimer', 'lastSessionEnd']);
      this.isTracking = result.isTracking !== false; // Default to true
      
      // Handle auto-resume timer if it exists
      if (result.autoResumeTimer && result.autoResumeTimer > Date.now()) {
        const remainingTime = result.autoResumeTimer - Date.now();
        console.log(`Auto-resume scheduled in ${Math.round(remainingTime / 1000)}s`);
        setTimeout(() => {
          this.enableTracking();
        }, remainingTime);
      } else if (result.autoResumeTimer) {
        // Timer expired, clean it up
        await chrome.storage.local.remove(['autoResumeTimer']);
      }

      // Check if browser was closed while tracking (session recovery)
      if (result.lastSessionEnd && this.isTracking) {
        console.log('Resuming tracking after browser restart');
      }
    } catch (error) {
      console.error('Error loading tracking state:', error);
      this.isTracking = true; // Default to enabled
    }
  }

  async saveTrackingState() {
    try {
      await chrome.storage.local.set({ 
        isTracking: this.isTracking,
        lastSessionEnd: Date.now()
      });
    } catch (error) {
      console.error('Error saving tracking state:', error);
    }
  }

  setupPeriodicSave() {
    // Save any buffered data every 30 seconds as a safety measure
    setInterval(() => {
      this.flushPendingData();
    }, 30000);
  }

  async flushPendingData() {
    if (this.pendingData.size === 0) return;

    try {
      const updates = {};
      for (const [date, urlData] of this.pendingData.entries()) {
        const storageKey = `data_${date}`;
        const existing = await chrome.storage.local.get([storageKey]);
        const dayData = existing[storageKey] || {};
        
        // Merge pending data with existing data
        for (const [url, timeMs] of Object.entries(urlData)) {
          dayData[url] = (dayData[url] || 0) + timeMs;
        }
        
        updates[storageKey] = dayData;
      }
      
      await chrome.storage.local.set(updates);
      this.pendingData.clear();
      console.log('Flushed pending data to storage');
    } catch (error) {
      console.error('Error flushing pending data:', error);
    }
  }

  startFocusDetection() {
    // Check focus every 10 seconds
    this.focusCheckInterval = setInterval(() => {
      this.checkChromeActive();
    }, 10000);
  }

  async checkChromeActive() {
    try {
      const windows = await chrome.windows.getAll();
      const focusedWindow = windows.find(window => window.focused);
      
      const wasChromeActive = this.isChromeActive;
      this.isChromeActive = !!focusedWindow;
      
      // If Chrome focus state changed, handle it
      if (wasChromeActive !== this.isChromeActive) {
        console.log(`Chrome focus changed: ${this.isChromeActive ? 'active' : 'inactive'}`);
        if (this.isChromeActive) {
          // Chrome regained focus, resume tracking
          await this.startTrackingCurrentTab();
        } else {
          // Chrome lost focus, pause tracking
          await this.pauseCurrentTracking();
        }
      }
    } catch (error) {
      console.error('Error checking Chrome active state:', error);
      // Fallback: assume Chrome is active if we can't determine
      this.isChromeActive = true;
    }
  }

  async handleTabChange(tabId) {
    if (!this.isTracking || !this.isChromeActive) return;
    
    try {
      // Save current tracking session
      await this.pauseCurrentTracking();
      
      // Start tracking new tab
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url && this.isValidUrl(tab.url)) {
        this.startTrackingUrl(tab.url, tabId);
      }
    } catch (error) {
      console.error('Error handling tab change:', error);
    }
  }

  async handleWindowFocusChange(windowId) {
    const wasChromeActive = this.isChromeActive;
    this.isChromeActive = windowId !== chrome.windows.WINDOW_ID_NONE;
    
    if (wasChromeActive !== this.isChromeActive) {
      console.log(`Window focus changed: ${this.isChromeActive ? 'active' : 'inactive'}`);
      if (this.isChromeActive) {
        await this.startTrackingCurrentTab();
      } else {
        await this.pauseCurrentTracking();
      }
    }
  }

  async handleBrowserStartup() {
    console.log('Browser startup detected');
    await this.loadTrackingState();
    if (this.isTracking) {
      await this.startTrackingCurrentTab();
    }
  }

  async handleBrowserShutdown() {
    console.log('Browser shutdown detected');
    await this.pauseCurrentTracking();
    await this.flushPendingData();
    await this.saveTrackingState();
  }

  isValidUrl(url) {
    // Filter out Chrome internal pages and invalid URLs
    if (!url) return false;
    if (url.startsWith('chrome://')) return false;
    if (url.startsWith('chrome-extension://')) return false;
    if (url.startsWith('edge://')) return false;
    if (url.startsWith('about:')) return false;
    if (url === 'data:text/html,chromewebdata') return false;
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async startTrackingCurrentTab() {
    if (!this.isTracking || !this.isChromeActive) return;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && this.isValidUrl(tab.url)) {
        this.startTrackingUrl(tab.url, tab.id);
      }
    } catch (error) {
      console.error('Error starting tracking for current tab:', error);
    }
  }

  startTrackingUrl(url, tabId) {
    const normalizedUrl = this.normalizeUrl(url);
    
    // Don't restart tracking if we're already tracking the same URL
    if (this.currentUrl === normalizedUrl && this.currentTabId === tabId) {
      return;
    }
    
    // Pause any current tracking before starting new
    if (this.currentUrl) {
      this.pauseCurrentTracking();
    }
    
    this.currentUrl = normalizedUrl;
    this.currentTabId = tabId;
    this.startTime = Date.now();
    
    console.log('Started tracking:', normalizedUrl);
  }

  async pauseCurrentTracking() {
    if (!this.currentUrl || !this.startTime) return;
    
    const timeSpent = Date.now() - this.startTime;
    
    // Only record if more than 5 seconds (5000ms)
    if (timeSpent >= 5000) {
      await this.recordTimeSpent(this.currentUrl, timeSpent);
      console.log(`Recorded ${Math.round(timeSpent/1000)}s for ${this.currentUrl}`);
    }
    
    this.currentUrl = null;
    this.currentTabId = null;
    this.startTime = null;
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Handle special cases for better grouping
      let hostname = urlObj.hostname;
      let pathname = urlObj.pathname;
      
      // Remove 'www.' prefix for consistency
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      // Remove trailing slash unless it's the root path
      if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      
      // Return protocol + cleaned hostname + pathname (no query params, hash, etc.)
      return `${urlObj.protocol}//${hostname}${pathname}`;
    } catch (error) {
      console.error('Error normalizing URL:', error);
      return url;
    }
  }

  async recordTimeSpent(url, timeMs) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Buffer the data first for better performance
      if (!this.pendingData.has(today)) {
        this.pendingData.set(today, {});
      }
      
      const dayData = this.pendingData.get(today);
      dayData[url] = (dayData[url] || 0) + timeMs;
      
      // Save immediately if it's been more than 10 seconds since last save
      const now = Date.now();
      if (now - this.lastSaveTime > 10000) {
        await this.flushPendingData();
        this.lastSaveTime = now;
      }
    } catch (error) {
      console.error('Error recording time spent:', error);
    }
  }

  async cleanupOldData() {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const allData = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      for (const key of Object.keys(allData)) {
        if (key.startsWith('data_')) {
          const dateStr = key.replace('data_', '');
          const date = new Date(dateStr);
          
          if (date < threeMonthsAgo) {
            keysToRemove.push(key);
          }
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} old data entries`);
      }
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  async enableTracking() {
    this.isTracking = true;
    await this.saveTrackingState();
    await this.startTrackingCurrentTab();
    
    // Clear any auto-resume timer
    await chrome.storage.local.remove(['autoResumeTimer']);
    console.log('Tracking enabled');
  }

  async disableTracking(autoResumeMinutes = 0) {
    await this.pauseCurrentTracking();
    await this.flushPendingData(); // Save any pending data
    
    this.isTracking = false;
    await this.saveTrackingState();
    
    // Set auto-resume timer if requested
    if (autoResumeMinutes > 0) {
      const resumeTime = Date.now() + (autoResumeMinutes * 60 * 1000);
      await chrome.storage.local.set({ autoResumeTimer: resumeTime });
      
      console.log(`Tracking disabled, auto-resume in ${autoResumeMinutes} minutes`);
      
      setTimeout(() => {
        this.enableTracking();
      }, autoResumeMinutes * 60 * 1000);
    } else {
      console.log('Tracking disabled');
    }
  }

  async openStatisticsPage() {
    const today = new Date().toISOString().split('T')[0];
    const url = chrome.runtime.getURL(`pages/statistics.html?date=${today}`);
    
    try {
      // Check if statistics page is already open
      const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('pages/statistics.html*') });
      
      if (tabs.length > 0) {
        // Focus existing tab
        await chrome.tabs.update(tabs[0].id, { active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        // Create new tab
        await chrome.tabs.create({ url });
      }
    } catch (error) {
      console.error('Error opening statistics page:', error);
      // Fallback: just create a new tab
      await chrome.tabs.create({ url });
    }
  }

  async checkFirstInstall() {
    try {
      const result = await chrome.storage.local.get(['installDate']);
      if (!result.installDate) {
        // First install
        const installDate = new Date().toISOString();
        await chrome.storage.local.set({ 
          installDate,
          repoInfo: 'hubwriter/chrome-time-tracker',
          creationDate: 'September 30, 2025'
        });
        
        // Show welcome page
        const welcomeUrl = chrome.runtime.getURL('pages/welcome.html');
        await chrome.tabs.create({ url: welcomeUrl });
        
        console.log('First install detected, showing welcome page');
      }
    } catch (error) {
      console.error('Error checking first install:', error);
    }
  }

  // Get current tracking status and statistics
  async getStatus() {
    return {
      isTracking: this.isTracking,
      currentUrl: this.currentUrl,
      currentSession: this.startTime ? Date.now() - this.startTime : 0,
      isChromeActive: this.isChromeActive
    };
  }
}

// Initialize the time tracker
const timeTracker = new TimeTracker();

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getTrackingState':
      timeTracker.getStatus().then(sendResponse);
      return true; // Will respond asynchronously
      
    case 'enableTracking':
      timeTracker.enableTracking().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'disableTracking':
      timeTracker.disableTracking(request.autoResumeMinutes || 0).then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'getCurrentStatus':
      timeTracker.getStatus().then(sendResponse);
      return true;
      
    case 'flushData':
      timeTracker.flushPendingData().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});