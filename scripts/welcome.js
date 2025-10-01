/**
 * Chrome Time Tracker - Welcome Page Script
 *
 * Handles the "Display this page on startup" checkbox functionality
 * on the welcome page. Saves and loads user preference for showing
 * the welcome page when the extension icon is clicked.
 *
 */

// Load and set the checkbox state from storage when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await chrome.storage.local.get(['showWelcomeOnStartup']);
        const showWelcome = result.showWelcomeOnStartup !== false; // Default to true
        const checkbox = document.getElementById('showWelcomeOnStartup');

        if (checkbox) {
            checkbox.checked = showWelcome;
            console.log('📖 Welcome preference loaded:', showWelcome);
        }
    } catch (error) {
        console.error('❌ Error loading welcome preference:', error);
    }
});

// Save the checkbox state when changed
document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('showWelcomeOnStartup');

    if (checkbox) {
        checkbox.addEventListener('change', async (e) => {
            try {
                await chrome.storage.local.set({ showWelcomeOnStartup: e.target.checked });
                console.log('💾 Welcome preference saved:', e.target.checked);
            } catch (error) {
                console.error('❌ Error saving welcome preference:', error);
            }
        });
    }
});
