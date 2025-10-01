/**
 * Chrome Time Tracker - Options Page Script
 *
 * Handles the extension options page functionality, allowing users
 * to configure extension settings including startup behavior.
 *
 */

// Load saved options when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadOptions();
        setupEventListeners();
        console.log('📋 Options page initialized');
    } catch (error) {
        console.error('❌ Error initializing options page:', error);
        showStatus('Error loading options', 'error');
    }
});

// Load options from storage
async function loadOptions() {
    try {
        const result = await chrome.storage.local.get(['showWelcomeOnStartup']);
        const showWelcome = result.showWelcomeOnStartup !== false; // Default to true

        const checkbox = document.getElementById('showWelcomeOnStartup');
        if (checkbox) {
            checkbox.checked = showWelcome;
            console.log('📋 Loaded welcome preference:', showWelcome);
        }
    } catch (error) {
        console.error('❌ Error loading options:', error);
        throw error;
    }
}

// Save options to storage
async function saveOptions() {
    try {
        const checkbox = document.getElementById('showWelcomeOnStartup');
        const saveButton = document.getElementById('save');

        if (!checkbox || !saveButton) return;

        // Disable save button during save
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        // Save the option
        await chrome.storage.local.set({
            showWelcomeOnStartup: checkbox.checked
        });

        console.log('💾 Options saved successfully');
        showStatus('Options saved successfully!', 'success');

        // Re-enable save button
        setTimeout(() => {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Options';
        }, 1000);

    } catch (error) {
        console.error('❌ Error saving options:', error);
        showStatus('Error saving options', 'error');

        // Re-enable save button on error
        const saveButton = document.getElementById('save');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Options';
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    const saveButton = document.getElementById('save');
    const checkbox = document.getElementById('showWelcomeOnStartup');

    if (saveButton) {
        saveButton.addEventListener('click', saveOptions);
    }

    // Auto-save when checkbox changes (optional - provides immediate feedback)
    if (checkbox) {
        checkbox.addEventListener('change', () => {
            // Optional: Could auto-save here, but keeping manual save for now
            clearStatus();
        });
    }

    // Keyboard shortcut for save (Ctrl+S or Cmd+S)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveOptions();
        }
    });
}

// Show status message
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = `status-message ${type}`;

        // Clear status after 3 seconds for success messages
        if (type === 'success') {
            setTimeout(clearStatus, 3000);
        }
    }
}

// Clear status message
function clearStatus() {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = '';
        status.className = 'status-message';
    }
}
