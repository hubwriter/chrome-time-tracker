// Test data generator - run this in the background script console to add sample data for today

async function addTestDataForToday() {
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `data_${today}`;
  
  // Sample browsing data (time in milliseconds)
  const testData = {
    'https://github.com/github/docs': 15 * 60 * 1000, // 15 minutes
    'https://stackoverflow.com/questions': 8 * 60 * 1000, // 8 minutes
    'https://developer.mozilla.org/en-US/docs': 12 * 60 * 1000, // 12 minutes
    'https://google.com/search': 5 * 60 * 1000, // 5 minutes
    'https://youtube.com/watch': 20 * 60 * 1000, // 20 minutes
    'https://github.com/hubwriter/dash-highlighter': 7 * 60 * 1000, // 7 minutes
    'https://chrome.google.com/webstore': 3 * 60 * 1000, // 3 minutes
    'https://twitter.com/home': 6 * 60 * 1000, // 6 minutes
  };
  
  await chrome.storage.local.set({ [storageKey]: testData });
  console.log('Test data