// Chrome Time Tracker - Background Script
// Handles automatic time tracking functionality

class TimeTracker {
  constructor() {
    this.currentUrl = null;
    this.currentTabId = null;
    this.startTime = null;
    this.isTracking = false;
    this.isChromeActive = true;
    this.focusCheckInterval = null;
    
    this.init();
  }

  async init() {
    console.log('Chrome Time Tracker: Background script initialized');
    
    // Load tracking state from storage
    await this.loadTrackingState();
    
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
  }

  async loadTrackingState() {
    try {
      const result = await chrome.storage.local.get(['isTracking', 'autoResumeTimer']);
      this.isTracking = result.isTracking !== false; // Default to true
      
      // Handle auto-resume timer if it exists
      if (result.autoResumeTimer && result.autoResumeTimer > Date.now()) {
        const remainingTime = result.autoResumeTimer - Date.now();
        setTimeout(() => {
          this.enableTracking();
        }, remainingTime);
      }
    } catch (error) {
      console.error('Error loading tracking state:', error);
      this.isTracking = true; // Default to enabled
    }
  }

  async saveTrackingState() {
    try {
      await chrome.storage.local.set({ isTracking: this.isTracking });
    } catch (error) {
      console.error('Error saving tracking state:', error);
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
      const currentWindow = await chrome.windows.getCurrent();
      const wasChromeActive = this.isChromeActive;
      this.isChromeActive = currentWindow.focused;
      
      // If Chrome focus state changed, handle it
      if (wasChromeActive !== this.isChromeActive) {
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
    }
  }

  async handleTabChange(tabId) {
    if (!this.isTracking || !this.isChromeActive) return;
    
    try {
      // Save current tracking session
      await this.pauseCurrentTracking();
      
      // Start tracking new tab
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url && !tab.url.startsWith('chrome://')) {
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
      if (this.isChromeActive) {
        await this.startTrackingCurrentTab();
      } else {
        await this.pauseCurrentTracking();
      }
    }
  }

  async startTrackingCurrentTab() {
    if (!this.isTracking) return;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && !tab.url.startsWith('chrome://')) {
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
      console.log(`Recorded ${timeSpent}ms for ${this.currentUrl}`);
    }
    
    this.currentUrl = null;
    this.currentTabId = null;
    this.startTime = null;
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Return protocol + hostname + pathname (no query params, hash, etc.)
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch (error) {
      console.error('Error normalizing URL:', error);
      return url;
    }
  }

  async recordTimeSpent(url, timeMs) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const storageKey = `data_${today}`;
      
      const result = await chrome.storage.local.get([storageKey]);
      const dayData = result[storageKey] || {};
      
      // Add time to existing or create new entry
      dayData[url] = (dayData[url] || 0) + timeMs;
      
      await chrome.storage.local.set({ [storageKey]: dayData });
    } catch (error) {
      console.error('Error recording time spent:', error);
    }
  }

  async enableTracking() {
    this.isTracking = true;
    await this.saveTrackingState();
    await this.startTrackingCurrentTab();
    
    // Clear any auto-resume timer
    await chrome.storage.local.remove(['autoResumeTimer']);
  }

  async disableTracking(autoResumeMinutes = 0) {
    await this.pauseCurrentTracking();
    this.isTracking = false;
    await this.saveTrackingState();
    
    // Set auto-resume timer if requested
    if (autoResumeMinutes > 0) {
      const resumeTime = Date.now() + (autoResumeMinutes * 60 * 1000);
      await chrome.storage.local.set({ autoResumeTimer: resumeTime });
      
      setTimeout(() => {
        this.enableTracking();
      }, autoResumeMinutes * 60 * 1000);
    }
  }

  async openStatisticsPage() {
    const url = chrome.runtime.getURL('pages/statistics.html');
    await chrome.tabs.create({ url });
  }

  async checkFirstInstall() {
    try {
      const result = await chrome.storage.local.get(['installDate']);
      if (!result.installDate) {
        // First install
        const installDate = new Date().toISOString();
        await chrome.storage.local.set({ 
          installDate,
          repoInfo: 'hubwriter/chrome-time-tracker'
        });
        
        // Show welcome page
        const welcomeUrl = chrome.runtime.getURL('pages/welcome.html');
        await chrome.tabs.create({ url: welcomeUrl });
      }
    } catch (error) {
      console.error('Error checking first install:', error);
    }
  }
}

// Initialize the time tracker
const timeTracker = new TimeTracker();

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getTrackingState':
      sendResponse({ isTracking: timeTracker.isTracking });
      break;
    case 'enableTracking':
      timeTracker.enableTracking();
      sendResponse({ success: true });
      break;
    case 'disableTracking':
      timeTracker.disableTracking(request.autoResumeMinutes || 0);
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ error: 'Unknown action' });
  }
});