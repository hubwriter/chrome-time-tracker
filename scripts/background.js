// Chrome Time Tracker - Simplified Reliable Tracking
console.log('🚀 Background script starting...');

class SimpleTimeTracker {
  constructor() {
    this.currentUrl = null;
    this.startTime = null;
    this.isTracking = true; // Always enabled by default
    this.saveInterval = null;
    
    this.init();
  }

  async init() {
    console.log('📊 SimpleTimeTracker initializing...');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start tracking current tab immediately
    await this.startTrackingCurrentTab();
    
    // Save data every 5 seconds
    this.setupAutoSave();
    
    console.log('✅ SimpleTimeTracker initialized');
  }

  setupEventListeners() {
    // Tab activated (user switches tabs)
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      console.log('🔄 Tab activated:', activeInfo.tabId);
      await this.handleTabChange(activeInfo.tabId);
    });

    // URL changed in current tab
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        console.log('🌐 URL changed:', changeInfo.url);
        await this.handleTabChange(tabId);
      }
    });

    // Extension icon clicked
    chrome.action.onClicked.addListener(() => {
      this.openStatisticsPage();
    });

    // Save data when tab closes
    chrome.tabs.onRemoved.addListener(() => {
      this.saveCurrentSession();
    });
  }

  setupAutoSave() {
    // Save every 5 seconds if there's an active session
    this.saveInterval = setInterval(() => {
      this.saveCurrentSession();
    }, 5000);
  }

  async handleTabChange(tabId) {
    try {
      // Save current session before switching
      this.saveCurrentSession();
      
      // Get the new tab
      const tab = await chrome.tabs.get(tabId);
      
      if (tab && tab.url && this.isValidUrl(tab.url)) {
        this.startTracking(tab.url);
      } else {
        this.stopTracking();
      }
    } catch (error) {
      console.error('❌ Error handling tab change:', error);
    }
  }

  async startTrackingCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url && this.isValidUrl(tab.url)) {
        this.startTracking(tab.url);
      }
    } catch (error) {
      console.error('❌ Error starting tracking for current tab:', error);
    }
  }

  startTracking(url) {
    const normalizedUrl = this.normalizeUrl(url);
    
    // Don't restart if already tracking same URL
    if (this.currentUrl === normalizedUrl) {
      return;
    }
    
    // Save previous session
    this.saveCurrentSession();
    
    // Start new session
    this.currentUrl = normalizedUrl;
    this.startTime = Date.now();
    
    console.log('▶️ STARTED TRACKING:', normalizedUrl);
  }

  stopTracking() {
    this.saveCurrentSession();
    this.currentUrl = null;
    this.startTime = null;
    console.log('⏹️ STOPPED TRACKING');
  }

  saveCurrentSession() {
    if (!this.currentUrl || !this.startTime) {
      return;
    }
    
    const timeSpent = Date.now() - this.startTime;
    const seconds = Math.round(timeSpent / 1000);
    
    // Only save if more than 3 seconds
    if (timeSpent < 3000) {
      console.log(`⏭️ Session too short: ${seconds}s for ${this.currentUrl}`);
      return;
    }
    
    console.log(`💾 SAVING: ${seconds}s for ${this.currentUrl}`);
    
    // Save to storage immediately
    this.saveToStorage(this.currentUrl, timeSpent);
    
    // Reset start time for next period
    this.startTime = Date.now();
  }

  async saveToStorage(url, timeMs) {
    try {
      // Fix: Use consistent date formatting to match statistics.js
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const storageKey = `data_${dateStr}`;
      
      console.log(`💾 Saving to key: ${storageKey}`);
      
      // Get existing data
      const result = await chrome.storage.local.get([storageKey]);
      const dayData = result[storageKey] || {};
      
      // Add new time
      dayData[url] = (dayData[url] || 0) + timeMs;
      
      // Save back to storage
      await chrome.storage.local.set({ [storageKey]: dayData });
      
      console.log(`✅ SAVED to storage: ${Math.round(timeMs/1000)}s for ${url} on ${dateStr}`);
      console.log(`📊 Total for ${url}: ${Math.round(dayData[url]/1000)}s`);
      
      // Verify save worked
      const verification = await chrome.storage.local.get([storageKey]);
      console.log(`🔍 Verification - ${storageKey}:`, verification[storageKey]);
      
    } catch (error) {
      console.error('❌ Error saving to storage:', error);
    }
  }

  isValidUrl(url) {
    if (!url) return false;
    if (url.startsWith('chrome://')) return false;
    if (url.startsWith('chrome-extension://')) return false;
    if (url.startsWith('edge://')) return false;
    if (url.startsWith('about:')) return false;
    if (url.startsWith('file://')) return false;
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      let pathname = urlObj.pathname;
      
      // Remove www
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      // Remove trailing slash
      if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      
      return `${urlObj.protocol}//${hostname}${pathname}`;
    } catch (error) {
      return url;
    }
  }

  async openStatisticsPage() {
    const url = chrome.runtime.getURL('pages/statistics.html');
    await chrome.tabs.create({ url });
  }

  // Status method for debugging
  getStatus() {
    const currentSession = this.startTime ? Date.now() - this.startTime : 0;
    return {
      isTracking: this.isTracking,
      currentUrl: this.currentUrl,
      currentSessionMs: currentSession,
      currentSessionSec: Math.round(currentSession / 1000)
    };
  }
}

// Initialize tracker
const tracker = new SimpleTimeTracker();

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request);
  
  switch (request.action) {
    case 'getTrackingState':
    case 'getCurrentStatus':
      sendResponse(tracker.getStatus());
      break;
      
    case 'enableTracking':
      tracker.isTracking = true;
      sendResponse({ success: true });
      break;
      
    case 'disableTracking':
      tracker.isTracking = false;
      tracker.stopTracking();
      sendResponse({ success: true });
      break;
      
    case 'forceTrackingCheck':
      tracker.startTrackingCurrentTab();
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// First install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('🎉 Extension installed');
    
    // Set install date
    await chrome.storage.local.set({ 
      installDate: new Date().toISOString(),
      repoInfo: 'hubwriter/chrome-time-tracker'
    });
    
    // Show welcome page
    const welcomeUrl = chrome.runtime.getURL('pages/welcome.html');
    await chrome.tabs.create({ url: welcomeUrl });
  }
});

console.log('📋 Background script loaded');