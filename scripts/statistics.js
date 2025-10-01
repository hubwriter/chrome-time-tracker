class StatisticsManager {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.currentData = null;
        this.showingAllUrls = false;
        this.pieChart = null;
        this.autoRefreshInterval = null;
        this.isPageVisible = true;
        this.chartHiddenItems = new Set();
        this.countdownInterval = null;
        this.refreshCount = 0;
        this.autoRefreshEnabled = true;

        console.log('📊 StatisticsManager: Initializing...');
        this.init();
    }

    async init() {
        try {
            console.log('📊 StatisticsManager: Starting initialization...');

            console.log('📊 StatisticsManager: Testing Chart.js availability...');
            console.log('📊 Chart.js available:', typeof Chart !== 'undefined');
            if (typeof Chart !== 'undefined') {
                console.log('📊 Chart.js version:', Chart.version || 'Unknown');
            }

            console.log('📊 StatisticsManager: Setting up event listeners...');
            this.setupEventListeners();

            console.log('📊 StatisticsManager: Loading tracking state...');
            await this.loadTrackingState();

            console.log('📊 StatisticsManager: Loading cleanup status...');
            await this.loadCleanupStatus();

            console.log('📊 StatisticsManager: Updating calendar...');
            await this.updateCalendar();

            console.log('📊 StatisticsManager: Auto-selecting today...');
            await this.autoSelectToday();

            console.log('📊 StatisticsManager: Starting auto-refresh...');
            this.startAutoRefresh();

            console.log('📊 StatisticsManager: Debugging storage data...');
            await this.debugStorageData();

            console.log('✅ StatisticsManager: Initialization complete');
        } catch (error) {
            console.error('❌ StatisticsManager: Initialization error:', error);
            console.error('❌ Error stack:', error.stack);

            // Show error in UI
            const monthElement = document.getElementById('currentMonth');
            if (monthElement) {
                monthElement.textContent = `Error: ${error.message}`;
            }
        }
    }

    startAutoRefresh() {
        console.log('🔄 Setting up auto-refresh (10 second intervals)');

        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            console.log(`👁️ Page visibility changed: ${this.isPageVisible ? 'visible' : 'hidden'}`);

            if (this.isPageVisible && this.autoRefreshEnabled) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });

        this.stopAutoRefresh();

        if (this.isPageVisible && this.autoRefreshEnabled) {
            this.autoRefreshInterval = setInterval(async () => {
                console.log('🔄 Auto-refreshing data...');
                await this.refreshCurrentData();
            }, 10000);

            console.log('✅ Auto-refresh started (10 second intervals)');
        }
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('⏹️ Auto-refresh stopped');
        }
    }

    toggleAutoRefresh(enabled) {
        this.autoRefreshEnabled = enabled;
        console.log(`🔄 Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);

        if (enabled && this.isPageVisible) {
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
        }
    }

    async manualRefreshStats() {
        console.log('🔄 Manual refresh requested');

        // Show immediate feedback
        const refreshBtn = document.getElementById('refreshStatsBtn');
        if (refreshBtn) {
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '🔄 Refreshing...';
            refreshBtn.disabled = true;

            try {
                await this.refreshCurrentData();
                await this.loadCleanupStatus();

                // Force update calendar to reflect any changes
                await this.updateCalendar();

                this.showNotification('✅ Statistics refreshed!', 'success');
            } catch (error) {
                console.error('❌ Error during manual refresh:', error);
                this.showNotification('❌ Refresh failed', 'error');
            } finally {
                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                    refreshBtn.disabled = false;
                }, 1000);
            }
        }
    }

    async refreshCurrentData() {
        try {
            if (!this.selectedDate) {
                console.log('⏭️ No date selected, skipping refresh');
                return;
            }

            const dateStr = this.getLocalDateString(this.selectedDate);
            console.log(`🔄 Refreshing data for ${dateStr}...`);

            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            const newData = result[`data_${dateStr}`] || {};

            const oldDataString = JSON.stringify(this.currentData);
            const newDataString = JSON.stringify(newData);

            if (oldDataString !== newDataString) {
                console.log('📊 Data has changed, updating display');
                console.log('📊 New data:', newData);

                this.currentData = newData;

                if (Object.keys(this.currentData).length === 0) {
                    this.showNoDataMessage();
                } else {
                    this.displayStatistics();
                }

                await this.updateCalendar();

                // Only show auto-refresh notification if it's not a manual refresh
                if (this.autoRefreshEnabled) {
                    this.showRefreshNotification();
                }
            } else {
                console.log('📊 Data unchanged');
            }

            // Periodically refresh cleanup status (every 10 refreshes = ~100 seconds)
            if (!this.refreshCount) this.refreshCount = 0;
            this.refreshCount++;

            if (this.refreshCount % 10 === 0) {
                console.log('🧹 Refreshing cleanup status...');
                await this.loadCleanupStatus();
            }

        } catch (error) {
            console.error('❌ Error refreshing data:', error);
        }
    }

    showRefreshNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #22c55e;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;
        notification.textContent = '🔄 Data updated';

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }

    getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    createDateFromCalendarDay(year, month, day) {
        return new Date(year, month, day, 12, 0, 0);
    }

    async autoSelectToday() {
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');

        if (!dateParam) {
            console.log('📅 Auto-selecting today');
            const today = new Date();
            await this.selectDate(today);
        } else {
            console.log('📅 URL has date parameter, using that instead');
            this.updateFromUrl();
        }
    }

    async debugStorageData() {
        try {
            const allData = await chrome.storage.local.get(null);
            console.log('📊 All storage data:', allData);

            const today = new Date();
            const todayStr = this.getLocalDateString(today);
            const todayKey = `data_${todayStr}`;
            console.log(`📅 Today's key: ${todayKey}`);
            console.log(`📈 Today's data:`, allData[todayKey]);

            if (allData[todayKey]) {
                const entries = Object.entries(allData[todayKey]);
                console.log(`📊 Today has ${entries.length} URLs:`, entries);
            }

            const dataKeys = Object.keys(allData).filter(key => key.startsWith('data_'));
            console.log('🗂️ Available data keys:', dataKeys);

            return allData;
        } catch (error) {
            console.error('❌ Error checking storage data:', error);
            return {};
        }
    }

    setupEventListeners() {
        const trackingToggle = document.getElementById('trackingToggle');
        const autoResumeCheckbox = document.getElementById('autoResumeCheckbox');
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        const cancelAutoResumeBtn = document.getElementById('cancelAutoResume');
        const manualCleanupBtn = document.getElementById('manualCleanupBtn');
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        const refreshStatsBtn = document.getElementById('refreshStatsBtn');

        if (trackingToggle) {
            trackingToggle.addEventListener('change', async (e) => {
                const isEnabled = e.target.checked;

                console.log(`🔄 Tracking toggle changed: ${isEnabled}`);

                if (isEnabled) {
                    // Tracking is being enabled
                    await this.enableTracking();
                    // Hide auto-resume container and stop any running timer
                    if (autoResumeContainer) autoResumeContainer.style.display = 'none';
                    this.stopAutoResumeTimer();
                } else {
                    // Tracking is being disabled
                    if (autoResumeContainer && autoResumeCheckbox) {
                        // Show the auto-resume container and set checkbox to checked by default
                        autoResumeCheckbox.checked = true;
                        autoResumeContainer.style.display = 'block';

                        // Disable tracking first
                        await this.disableTracking(10);

                        // Since auto-resume is checked by default, start the timer immediately
                        this.startAutoResumeTimer(10);
                    } else {
                        // Fallback if elements not found
                        await this.disableTracking(0);
                    }
                }

                this.updateToggleLabel(isEnabled);
            });
        } else {
            console.warn('⚠️ trackingToggle element not found');
        }

        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.toggleAutoRefresh(e.target.checked);
            });
        } else {
            console.warn('⚠️ autoRefreshToggle element not found');
        }

        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', () => {
                this.manualRefreshStats();
            });
        } else {
            console.warn('⚠️ refreshStatsBtn element not found');
        }

        if (cancelAutoResumeBtn) {
            cancelAutoResumeBtn.addEventListener('click', () => {
                this.cancelAutoResume();
            });
        }

        if (manualCleanupBtn) {
            manualCleanupBtn.addEventListener('click', () => {
                this.runManualCleanup();
            });
        }

        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (prevBtn) prevBtn.addEventListener('click', () => this.changeMonth(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changeMonth(1));

        const expandBtn = document.getElementById('expandListBtn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.toggleUrlList());
        }

        window.addEventListener('popstate', () => this.updateFromUrl());
        window.addEventListener('beforeunload', () => {
            this.stopAutoRefresh();
            this.stopAutoResumeTimer();
        });

        // Only check for existing auto-resume timer if tracking is disabled
        this.checkExistingAutoResumeTimer();
    }

    // Cleanup management methods
    async loadCleanupStatus() {
        try {
            console.log('🧹 Loading cleanup status...');
            const stats = await chrome.runtime.sendMessage({ action: 'getCleanupStats' });

            if (stats) {
                this.updateCleanupDisplay(stats);
                console.log('🧹 Cleanup stats loaded:', stats);
            } else {
                console.warn('⚠️ No cleanup stats received');
            }
        } catch (error) {
            console.error('❌ Error loading cleanup status:', error);
        }
    }

    updateCleanupDisplay(stats) {
        const statusElement = document.getElementById('cleanupStatus');

        if (!statusElement || !stats) return;

        const { lastCleanup, totalDataEntries } = stats;

        if (lastCleanup) {
            const lastCleanupDate = new Date(lastCleanup.timestamp);
            const now = new Date();
            const daysDiff = Math.floor((now - lastCleanupDate) / (24 * 60 * 60 * 1000));

            let statusText = '';
            if (daysDiff === 0) {
                statusText = 'Last cleaned today';
            } else if (daysDiff === 1) {
                statusText = 'Last cleaned yesterday';
            } else {
                statusText = `Last cleaned ${daysDiff} days ago`;
            }

            if (lastCleanup.removedEntries > 0) {
                statusText += ` (removed ${lastCleanup.removedEntries} entries)`;
            }

            statusElement.textContent = `${statusText} (${totalDataEntries} entries)`;
        } else {
            statusElement.textContent = `No cleanup performed yet (${totalDataEntries} entries)`;
        }
    }

    async runManualCleanup() {
        const manualCleanupBtn = document.getElementById('manualCleanupBtn');
        const statusElement = document.getElementById('cleanupStatus');

        if (!manualCleanupBtn || !statusElement) return;

        try {
            console.log('🧹 Running manual cleanup...');

            manualCleanupBtn.disabled = true;
            manualCleanupBtn.textContent = 'Cleaning...';
            statusElement.textContent = 'Cleanup in progress...';

            this.showNotification('🧹 Starting data cleanup...', 'info');

            const response = await chrome.runtime.sendMessage({ action: 'manualCleanup' });

            if (response && response.success) {
                console.log('✅ Manual cleanup completed successfully');
                this.showNotification('✅ Data cleanup completed!', 'success');

                setTimeout(async () => {
                    await this.loadCleanupStatus();
                    await this.updateCalendar();

                    if (this.selectedDate) {
                        await this.loadDataForDate();
                    }
                }, 1000);

            } else {
                console.error('❌ Manual cleanup failed:', response?.error);
                this.showNotification('❌ Cleanup failed. Please try again.', 'error');
            }

        } catch (error) {
            console.error('❌ Error running manual cleanup:', error);
            this.showNotification('❌ Cleanup error. Please try again.', 'error');
        } finally {
            manualCleanupBtn.disabled = false;
            manualCleanupBtn.textContent = 'Run Cleanup Now';
        }
    }

    formatStorageSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async loadTrackingState() {
        try {
            console.log('📡 Sending message to background script...');
            const response = await chrome.runtime.sendMessage({ action: 'getTrackingState' });
            console.log('📡 Tracking state response:', response);

            const trackingToggle = document.getElementById('trackingToggle');
            const autoResumeContainer = document.getElementById('autoResumeContainer');

            if (trackingToggle && response) {
                const isTracking = response.isTracking !== false;
                trackingToggle.checked = isTracking;
                this.updateToggleLabel(isTracking);

                // Show auto-resume container if tracking is disabled
                if (!isTracking && autoResumeContainer) {
                    autoResumeContainer.style.display = 'block';

                    // Check if there's an active auto-resume timer
                    const result = await chrome.storage.local.get(['autoResumeTimer']);
                    const timerData = result.autoResumeTimer;

                    if (timerData && timerData.active) {
                        // There's an active timer, it will be restored by checkExistingAutoResumeTimer
                        console.log('⏰ Active timer found, will be restored');
                    } else {
                        // No active timer, show the reset state
                        this.showResetAutoResumeState();
                    }
                } else {
                    // Tracking is enabled, hide auto-resume container
                    if (autoResumeContainer) {
                        autoResumeContainer.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error loading tracking state:', error);
        }
    }

    updateToggleLabel(isEnabled) {
        const label = document.querySelector('.toggle-label');
        if (label) {
            label.textContent = isEnabled ? 'Tracking Enabled' : 'Tracking Disabled';
        }
    }

    async enableTracking() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'enableTracking' });
            console.log('✅ Enable tracking response:', response);
        } catch (error) {
            console.error('❌ Error enabling tracking:', error);
        }
    }

    async disableTracking(autoResumeMinutes = 0) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'disableTracking',
                autoResumeMinutes
            });
            console.log('⏸️ Disable tracking response:', response);
        } catch (error) {
            console.error('❌ Error disabling tracking:', error);
        }
    }

    // Auto-resume timer management
    async startAutoResumeTimer(minutes) {
        console.log(`⏰ Starting auto-resume timer for ${minutes} minutes`);

        const endTime = Date.now() + (minutes * 60 * 1000);

        // Save timer state to storage
        await chrome.storage.local.set({
            autoResumeTimer: {
                endTime: endTime,
                active: true,
                startTime: Date.now()
            }
        });

        // Show timer UI
        this.showAutoResumeTimer();

        // Start countdown display
        this.startTimerCountdown(endTime);

        // Notify background script
        try {
            await chrome.runtime.sendMessage({
                action: 'startAutoResumeTimer',
                endTime: endTime
            });
        } catch (error) {
            console.error('❌ Error starting background timer:', error);
        }
    }

    startTimerCountdown(endTime) {
        const timerElement = document.getElementById('timerCountdown');
        if (!timerElement) return;

        // Clear existing timer
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            const remaining = endTime - Date.now();

            if (remaining <= 0) {
                // Timer finished
                this.onAutoResumeComplete();
                return;
            }

            // Update display
            const minutes = Math.floor(remaining / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        }, 1000);
    }

    showAutoResumeTimer() {
        const timerContainer = document.getElementById('autoResumeTimer');
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        const cancelBtn = document.getElementById('cancelAutoResume');

        if (timerContainer && autoResumeContainer) {
            timerContainer.style.display = 'flex';
            autoResumeContainer.style.display = 'block';

            // Hide the checkbox option
            const autoResumeOption = document.querySelector('.auto-resume-option');
            if (autoResumeOption) {
                autoResumeOption.style.display = 'none';
            }

            // Update button text to show cancelling option
            if (cancelBtn) {
                cancelBtn.textContent = 'Cancel Auto-Resume';
            }
        }
    }

    showResetAutoResumeState() {
        const timerContainer = document.getElementById('autoResumeTimer');
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        const timerElement = document.getElementById('timerCountdown');
        const cancelBtn = document.getElementById('cancelAutoResume');
        const autoResumeCheckbox = document.getElementById('autoResumeCheckbox');

        if (autoResumeContainer) {
            autoResumeContainer.style.display = 'block';

            // Show timer in reset state
            if (timerContainer) {
                timerContainer.style.display = 'flex';
            }

            // Hide the checkbox option
            const autoResumeOption = document.querySelector('.auto-resume-option');
            if (autoResumeOption) {
                autoResumeOption.style.display = 'none';
            }

            // Set timer to 10:00 and stop countdown
            if (timerElement) {
                timerElement.textContent = '10:00';
            }

            // Update button to enable auto-resume
            if (cancelBtn) {
                cancelBtn.textContent = 'Enable Auto-Resume';
            }

            // Check the checkbox by default
            if (autoResumeCheckbox) {
                autoResumeCheckbox.checked = true;
            }

            // Stop any running countdown
            this.stopAutoResumeTimer();
        }
    }

    async cancelAutoResume() {
        console.log('🚫 Cancelling/toggling auto-resume timer');

        const cancelBtn = document.getElementById('cancelAutoResume');
        const currentText = cancelBtn ? cancelBtn.textContent : '';

        if (currentText === 'Enable Auto-Resume') {
            // Enable auto-resume (start the timer)
            console.log('▶️ Enabling auto-resume timer');
            this.startAutoResumeTimer(10);
            this.showNotification('⏰ Auto-resume enabled - tracking will resume in 10 minutes', 'info');
        } else {
            // Cancel auto-resume (reset to stopped state)
            console.log('⏹️ Cancelling auto-resume timer');

            // Stop countdown
            this.stopAutoResumeTimer();

            // Clear storage
            await chrome.storage.local.remove(['autoResumeTimer']);

            // Notify background script
            try {
                await chrome.runtime.sendMessage({ action: 'cancelAutoResumeTimer' });
            } catch (error) {
                console.error('❌ Error cancelling background timer:', error);
            }

            // Show reset state (keep container visible but reset timer)
            this.showResetAutoResumeState();

            // Show notification
            this.showNotification('⏹️ Auto-resume cancelled', 'info');
        }
    }

    stopAutoResumeTimer() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    async onAutoResumeComplete() {
        console.log('✅ Auto-resume timer completed - enabling tracking');

        // Stop timer
        this.stopAutoResumeTimer();

        // Clear storage
        await chrome.storage.local.remove(['autoResumeTimer']);

        // Enable tracking
        await this.enableTracking();

        // Update UI
        const trackingToggle = document.getElementById('trackingToggle');
        if (trackingToggle) {
            trackingToggle.checked = true;
        }
        this.updateToggleLabel(true);

        // Hide auto-resume container
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        if (autoResumeContainer) {
            autoResumeContainer.style.display = 'none';
        }

        // Show notification
        this.showNotification('🔄 Tracking automatically resumed!', 'success');
    }

    async checkExistingAutoResumeTimer() {
        try {
            const result = await chrome.storage.local.get(['autoResumeTimer']);
            const timerData = result.autoResumeTimer;

            if (timerData && timerData.active) {
                // Only restore timer if tracking is currently disabled
                const trackingResponse = await chrome.runtime.sendMessage({ action: 'getTrackingState' });
                const isTracking = trackingResponse && trackingResponse.isTracking !== false;

                if (!isTracking) {
                    const remaining = timerData.endTime - Date.now();

                    if (remaining > 0) {
                        console.log('⏰ Found existing auto-resume timer with', Math.floor(remaining / 1000), 'seconds remaining');
                        this.showAutoResumeTimer();
                        this.startTimerCountdown(timerData.endTime);
                    } else {
                        // Timer should have completed
                        console.log('⏰ Existing timer has expired, cleaning up');
                        await chrome.storage.local.remove(['autoResumeTimer']);
                        this.showResetAutoResumeState();
                    }
                } else {
                    // Tracking is enabled, so remove any stale timer data
                    console.log('⏰ Tracking is enabled, removing stale auto-resume timer');
                    await chrome.storage.local.remove(['autoResumeTimer']);
                }
            }
        } catch (error) {
            console.error('❌ Error checking existing timer:', error);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#dc3545' : '#0ea5e9'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 300px;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);

        // Fade out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    changeMonth(direction) {
        const newDate = new Date(this.currentDate);
        newDate.setMonth(newDate.getMonth() + direction);

        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        twoMonthsAgo.setDate(1);

        if (newDate < twoMonthsAgo) {
            return;
        }

        const now = new Date();
        if (newDate.getFullYear() > now.getFullYear() ||
            (newDate.getFullYear() === now.getFullYear() && newDate.getMonth() > now.getMonth())) {
            return;
        }

        this.currentDate = newDate;
        this.selectedDate = null;

        // Check if we're displaying the current month
        const isCurrentMonth = newDate.getFullYear() === now.getFullYear() &&
                              newDate.getMonth() === now.getMonth();

        if (isCurrentMonth) {
            // Auto-select today's date when displaying current month
            console.log('📅 Displaying current month, auto-selecting today');
            this.selectedDate = now;
            this.updateUrl();
            this.updateCalendar();
            this.loadDataForDate();
        } else {
            // For non-current months, just update calendar and show no data
            this.updateCalendar();
            this.updateUrl();
            this.showNoDataMessage();
        }
    }

    async updateCalendar() {
        console.log('📅 Updating calendar...');

        const monthElement = document.getElementById('currentMonth');
        const calendarElement = document.getElementById('calendar');

        if (!monthElement || !calendarElement) {
            console.error('❌ Calendar elements not found');
            console.error('❌ monthElement:', monthElement);
            console.error('❌ calendarElement:', calendarElement);
            return;
        }

        const monthName = this.currentDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
        monthElement.textContent = monthName;

        this.updateNavigationButtons();
        await this.generateCalendarGrid(calendarElement);
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (!prevBtn || !nextBtn) return;

        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const prevMonth = new Date(this.currentDate);
        prevMonth.setMonth(prevMonth.getMonth() - 1);

        prevBtn.disabled = prevMonth < twoMonthsAgo;

        const now = new Date();
        const nextMonth = new Date(this.currentDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        nextBtn.disabled = nextMonth.getFullYear() > now.getFullYear() ||
                          (nextMonth.getFullYear() === now.getFullYear() && nextMonth.getMonth() > now.getMonth());
    }

    async generateCalendarGrid(container) {
        console.log('📅 Generating calendar grid...');
        container.innerHTML = '';

        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'calendar-header-cell';
            headerCell.textContent = day;
            container.appendChild(headerCell);
        });

        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const today = new Date();
        const todayStr = this.getLocalDateString(today);

        for (let i = 0; i < firstDay.getDay(); i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day disabled';
            container.appendChild(emptyCell);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayElement = document.createElement('button');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;

            const cellDate = this.createDateFromCalendarDay(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth(),
                day
            );
            const dateStr = this.getLocalDateString(cellDate);

            const hasData = await this.hasDataForDate(dateStr);
            if (hasData) {
                dayElement.classList.add('has-data');
                console.log(`📊 Day ${day} (${dateStr}) has data`);
            }

            const isToday = dateStr === todayStr;

            if (cellDate > today && !isToday) {
                dayElement.classList.add('future');
                dayElement.disabled = true;
            } else {
                dayElement.addEventListener('click', () => {
                    console.log(`🎯 Clicked on day ${day} (${dateStr})`);
                    this.selectDate(cellDate);
                });
            }

            if (this.selectedDate &&
                cellDate.toDateString() === this.selectedDate.toDateString()) {
                dayElement.classList.add('selected');
                console.log(`✅ Day ${day} is selected`);
            }

            container.appendChild(dayElement);
        }

        console.log('📅 Calendar grid generated');
    }

    async hasDataForDate(dateStr) {
        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            const data = result[`data_${dateStr}`];
            const hasData = data && Object.keys(data).length > 0;
            return hasData;
        } catch (error) {
            console.error('❌ Error checking data for date:', error);
            return false;
        }
    }

    async selectDate(date) {
        console.log('🎯 Selecting date:', date);
        const dateStr = this.getLocalDateString(date);
        console.log('🎯 Date string for storage:', dateStr);

        this.selectedDate = date;
        this.updateUrl();
        await this.loadDataForDate();
        await this.updateCalendar();
    }

    async loadDataForDate() {
        if (!this.selectedDate) {
            console.log('⚠️ No date selected');
            this.showNoDataMessage();
            return;
        }

        const dateStr = this.getLocalDateString(this.selectedDate);
        console.log('📥 Loading data for date:', dateStr);

        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            this.currentData = result[`data_${dateStr}`] || {};

            console.log('📊 Loaded data for', dateStr, ':', this.currentData);
            console.log('📊 Number of URLs:', Object.keys(this.currentData).length);

            if (Object.keys(this.currentData).length === 0) {
                console.log('🚫 No data found for this date');
                this.showNoDataMessage();
            } else {
                console.log('✅ Displaying statistics for', Object.keys(this.currentData).length, 'URLs');
                this.displayStatistics();
            }
        } catch (error) {
            console.error('❌ Error loading data for date:', error);
            this.showNoDataMessage();
        }
    }

    showNoDataMessage() {
        const noDataMessage = document.getElementById('noDataMessage');
        const statisticsContent = document.getElementById('statisticsContent');

        if (noDataMessage) {
            noDataMessage.style.display = 'block';
            noDataMessage.innerHTML = '<p>No viewing data available for this date.</p>';
        }
        if (statisticsContent) {
            statisticsContent.style.display = 'none';
        }

        console.log('💭 Showing no data message');
    }

    displayStatistics() {
        console.log('📊 DisplayStatistics called with data:', this.currentData);
        console.log('📊 Data entries:', Object.entries(this.currentData));

        const noDataMessage = document.getElementById('noDataMessage');
        const statisticsContent = document.getElementById('statisticsContent');

        if (noDataMessage) {
            noDataMessage.style.display = 'none';
            console.log('✅ Hiding no data message');
        }
        if (statisticsContent) {
            statisticsContent.style.display = 'block';
            console.log('✅ Showing statistics content');
        }

        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement) {
            selectedDateElement.textContent = `Statistics for ${this.selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`;
            console.log('✅ Updated selected date display');
        }

        this.showingAllUrls = false;
        this.updateTable();
        this.updateChart();

        console.log('📊 Statistics displayed successfully');
    }

    updateTable() {
        const tbody = document.getElementById('statisticsTableBody');
        const expandBtn = document.getElementById('expandListBtn');

        if (!tbody) {
            console.error('❌ Table body not found');
            return;
        }

        console.log('📊 Updating table with current data:', this.currentData);

        tbody.innerHTML = '';

        const sortedEntries = Object.entries(this.currentData)
            .sort(([,a], [,b]) => b - a);

        console.log('📊 Sorted entries:', sortedEntries);

        const entriesToShow = this.showingAllUrls ? sortedEntries : sortedEntries.slice(0, 20);

        console.log(`📊 Showing ${entriesToShow.length} entries out of ${sortedEntries.length} total`);

        entriesToShow.forEach(([url, timeMs], index) => {
            const row = document.createElement('tr');

            const urlCell = document.createElement('td');
            urlCell.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            row.appendChild(urlCell);

            const timeCell = document.createElement('td');
            const formattedTime = this.formatTime(timeMs);
            timeCell.textContent = formattedTime;
            row.appendChild(timeCell);

            tbody.appendChild(row);
            console.log(`📊 Added row ${index + 1}: ${url} - ${formattedTime} (${timeMs}ms)`);
        });

        if (expandBtn) {
            if (sortedEntries.length > 20) {
                expandBtn.style.display = 'block';
                expandBtn.textContent = this.showingAllUrls ? 'Show Top 20' : 'Show All URLs';
            } else {
                expandBtn.style.display = 'none';
            }
        }

        console.log(`✅ Table updated successfully with ${entriesToShow.length} entries`);
    }

    toggleUrlList() {
        this.showingAllUrls = !this.showingAllUrls;
        this.updateTable();
        this.updateChart();
    }

    updateChart() {
        const canvas = document.getElementById('pieChart');
        const chartContainer = document.getElementById('chartContainer');

        if (!canvas || !chartContainer) {
            console.log('📊 Chart elements not found, skipping chart update');
            return;
        }

        // Hide chart if showing all URLs (as per PRD - only show for top 20)
        if (this.showingAllUrls) {
            chartContainer.style.display = 'none';
            return;
        } else {
            chartContainer.style.display = 'block';
        }

        // Destroy existing chart
        if (this.pieChart && this.pieChart.destroy) {
            this.pieChart.destroy();
        }

        // Prepare data for chart - top 20 URLs only
        const sortedEntries = Object.entries(this.currentData)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);

        if (sortedEntries.length === 0) {
            console.log('📊 No data for chart');
            chartContainer.style.display = 'none';
            return;
        }

        // Calculate total time and filter entries with >= 1%
        const totalTime = sortedEntries.reduce((sum, [,timeMs]) => sum + timeMs, 0);
        const filteredEntries = sortedEntries.filter(([,timeMs]) => {
            const percentage = (timeMs / totalTime) * 100;
            return percentage >= 1.0;
        });

        // If no entries meet the 1% threshold, show a message
        if (filteredEntries.length === 0) {
            this.showChartMessage('No pages viewed for 1% or more of the time.');
            return;
        }

        // Initialize hidden state tracking if not exists
        if (!this.chartHiddenItems) {
            this.chartHiddenItems = new Set();
        }

        // Filter out hidden items
        const visibleEntries = filteredEntries.filter(([url]) => !this.chartHiddenItems.has(url));

        if (visibleEntries.length === 0) {
            this.showChartMessage('All chart entries are currently hidden. Click legend items to show them.');
            return;
        }

        const labels = visibleEntries.map(([url]) => this.shortenUrl(url));
        const data = visibleEntries.map(([,timeMs]) => timeMs);
        const colors = this.generateDomainConsistentColors(visibleEntries);
        const originalUrls = visibleEntries.map(([url]) => url);

        // Add chart explanation
        this.addChartExplanation(filteredEntries.length, sortedEntries.length);

        // Check if Chart.js is available
        if (typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');
            this.pieChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverBorderWidth: 3,
                        hoverBorderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: {
                                    size: 12
                                },
                                generateLabels: (chart) => {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        const allLabels = [];
                                        const visibleTotal = data.datasets[0].data.reduce((a, b) => a + b, 0);

                                        // Add visible entries
                                        data.labels.forEach((label, i) => {
                                            const dataset = data.datasets[0];
                                            const value = dataset.data[i];
                                            const percentage = ((value / visibleTotal) * 100).toFixed(1);
                                            const url = originalUrls[i];

                                            allLabels.push({
                                                text: `${label} (${percentage}%)`,
                                                fillStyle: dataset.backgroundColor[i],
                                                strokeStyle: dataset.borderColor,
                                                lineWidth: dataset.borderWidth,
                                                hidden: false,
                                                index: i,
                                                url: url
                                            });
                                        });

                                        // Add hidden entries
                                        filteredEntries.forEach(([url], i) => {
                                            if (this.chartHiddenItems.has(url)) {
                                                const timeMs = filteredEntries.find(([u]) => u === url)[1];
                                                const percentage = ((timeMs / totalTime) * 100).toFixed(1);
                                                const shortUrl = this.shortenUrl(url);

                                                allLabels.push({
                                                    text: `${shortUrl} (${percentage}%) - Hidden`,
                                                    fillStyle: '#cccccc',
                                                    strokeStyle: '#999999',
                                                    lineWidth: 1,
                                                    hidden: true,
                                                    index: -1,
                                                    url: url
                                                });
                                            }
                                        });

                                        return allLabels;
                                    }
                                    return [];
                                }
                            },
                            onClick: (e, legendItem) => {
                                if (legendItem.url) {
                                    this.toggleChartItem(legendItem.url);
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = this.formatTime(context.raw);
                                    const visibleTotal = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.raw / visibleTotal) * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 20,
                            bottom: 20
                        }
                    }
                }
            });

            console.log('📊 Chart updated successfully with', visibleEntries.length, 'visible entries (', filteredEntries.length, 'total >= 1%)');
        } else {
            console.warn('⚠️ Chart.js not available, hiding chart container');
            chartContainer.style.display = 'none';
        }
    }

    addChartExplanation(filteredCount, totalCount) {
        // Remove existing explanation if present
        const existingExplanation = document.getElementById('chartExplanation');
        if (existingExplanation) {
            existingExplanation.remove();
        }

        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) return;

        const explanation = document.createElement('div');
        explanation.id = 'chartExplanation';
        explanation.style.cssText = `
            margin-bottom: 20px;
            padding: 15px;
            background: #f0f7ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            color: #1e40af;
            font-size: 14px;
            line-height: 1.5;
        `;

        const hiddenCount = this.chartHiddenItems ? this.chartHiddenItems.size : 0;
        const visibleCount = filteredCount - hiddenCount;

        let explanationText = `Pages with at least 1% of viewing time (${filteredCount} of ${totalCount} pages).`;

        if (hiddenCount > 0) {
            explanationText += ` ${hiddenCount} entries are currently hidden.`;
        }

        explanationText += ` Click legend entries below the chart to exclude/include pages from the chart.`;

        explanation.textContent = explanationText;

        // Insert before the canvas
        const canvas = document.getElementById('pieChart');
        chartContainer.insertBefore(explanation, canvas);
    }

    showChartMessage(message) {
        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) return;

        chartContainer.innerHTML = `
            <div style="
                text-align: center;
                padding: 40px 20px;
                color: #718096;
                font-style: italic;
                background: #f7fafc;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            ">
                ${message}
            </div>
        `;
    }

    toggleChartItem(url) {
        if (!this.chartHiddenItems) {
            this.chartHiddenItems = new Set();
        }

        if (this.chartHiddenItems.has(url)) {
            this.chartHiddenItems.delete(url);
            console.log('📊 Showing chart item:', this.shortenUrl(url));
        } else {
            this.chartHiddenItems.add(url);
            console.log('📊 Hiding chart item:', this.shortenUrl(url));
        }

        // Refresh the chart
        this.updateChart();
    }

    generateDomainConsistentColors(entries) {
        const colors = [];
        const domainColorMap = new Map();

        // Pre-defined color palette for consistent domain coloring
        const colorPalette = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
            '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#FF99CC', '#66B2FF', '#99FF99', '#FFB366', '#B366FF'
        ];

        let colorIndex = 0;

        entries.forEach(([url], index) => {
            let domain;
            try {
                domain = new URL(url).hostname;
            } catch {
                domain = url;
            }

            // Check if we've already assigned a color to this domain
            if (domainColorMap.has(domain)) {
                colors.push(domainColorMap.get(domain));
            } else {
                // Assign new color to domain
                const color = colorPalette[colorIndex % colorPalette.length];
                domainColorMap.set(domain, color);
                colors.push(color);
                colorIndex++;
            }
        });

        // Ensure contrasting adjacent segments
        for (let i = 1; i < colors.length; i++) {
            if (colors[i] === colors[i - 1]) {
                // Find a different color for adjacent segments
                const availableColors = colorPalette.filter(c => c !== colors[i - 1]);
                colors[i] = availableColors[i % availableColors.length];
            }
        }

        return colors;
    }

    shortenUrl(url) {
        try {
            const urlObj = new URL(url);
            let displayUrl = urlObj.hostname;

            // Add path if it's meaningful (not just "/")
            if (urlObj.pathname && urlObj.pathname !== '/') {
                displayUrl += urlObj.pathname;
                // Truncate very long paths
                if (displayUrl.length > 40) {
                    displayUrl = displayUrl.substring(0, 37) + '...';
                }
            }

            return displayUrl;
        } catch {
            // Fallback for invalid URLs
            return url.length > 40 ? url.substring(0, 37) + '...' : url;
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (remainingMinutes > 0) parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`);
        if (remainingSeconds > 0 || parts.length === 0) {
            parts.push(`${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`);
        }

        return parts.join(', ');
    }

    updateUrl() {
        const url = new URL(window.location);
        if (this.selectedDate) {
            const dateStr = this.getLocalDateString(this.selectedDate);
            url.searchParams.set('date', dateStr);
            console.log('🔗 Updating URL with date:', dateStr);
        } else {
            url.searchParams.delete('date');
        }
        window.history.pushState({}, '', url);
    }

    updateFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');

        if (dateParam) {
            console.log('📅 Loading date from URL:', dateParam);
            const [year, month, day] = dateParam.split('-').map(Number);
            const date = this.createDateFromCalendarDay(year, month - 1, day);

            if (!isNaN(date.getTime())) {
                this.selectedDate = date;
                this.currentDate = new Date(date.getFullYear(), date.getMonth(), 1);
                this.updateCalendar();
                this.loadDataForDate();
                return;
            }
        }

        console.log('📅 No valid date in URL, will auto-select today');
    }
}

let statsManager;

// Add more robust DOM ready checking
function initializeWhenReady() {
    if (document.readyState === 'loading') {
        console.log('📊 DOM still loading, waiting...');
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📊 DOM loaded via event listener');
            initializeStatsManager();
        });
    } else {
        console.log('📊 DOM already loaded');
        initializeStatsManager();
    }
}

function initializeStatsManager() {
    console.log('🚀 Initializing StatisticsManager...');
    console.log('🚀 Document ready state:', document.readyState);

    // Check if required elements exist
    const requiredElements = ['currentMonth', 'calendar', 'trackingToggle'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
        console.error('❌ Missing required elements:', missingElements);
        console.error('❌ Available elements:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
        return;
    }

    try {
        statsManager = new StatisticsManager();
        window.statsManager = statsManager;
        console.log('✅ StatisticsManager initialized and exposed globally');
    } catch (error) {
        console.error('❌ Failed to create StatisticsManager:', error);
        console.error('❌ Error stack:', error.stack);
    }
}

// Start initialization
initializeWhenReady();

// Add cleanup notification listener
if (chrome.notifications) {
    chrome.notifications.onClicked.addListener((notificationId) => {
        if (notificationId === 'data-cleanup') {
            console.log('🧹 Cleanup notification clicked - refreshing cleanup status');
            if (window.statsManager) {
                window.statsManager.loadCleanupStatus();
            }
        }
    });
}

// Listen for storage changes that might indicate cleanup
if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.lastCleanup) {
            console.log('🧹 Cleanup status changed, refreshing display');
            if (window.statsManager) {
                window.statsManager.loadCleanupStatus();
            }
        }
    });
}
