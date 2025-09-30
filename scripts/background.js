// Update the saveToStorage method in background.js to use the same date format:

async saveToStorage(url, timeMs) {
  try {
    // Fix: Use consistent date formatting
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const storageKey = `data_${dateStr}`;
    
    // Get existing data
    const result = await chrome.storage.local.get([storageKey]);
    const dayData = result[storageKey] || {};
    
    // Add new time
    dayData[url] = (dayData[url] || 0) + timeMs;
    
    // Save back to storage
    await chrome.storage.local.set({ [storageKey]: dayData });
    
    console.log(`✅ SAVED to storage: ${Math.round(timeMs/1000)}s for ${url} on ${dateStr}`);
    console.log(`📊 Total for ${url}: ${Math.round(dayData[url]/1000)}s`);
    
  } catch (error) {
    console.error('❌ Error saving to storage:', error);
  }
}