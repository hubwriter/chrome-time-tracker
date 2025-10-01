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
        this.autoRefreshEnabled = true;

        console.log('📊 StatisticsManager: Initializing...');
        this.init();
    }

    async init() {
        try {
            console.log('📊 StatisticsManager: Starting initialization...');

            this.setupEventListeners();
            await this.loadTrackingState();
            await this.updateCalendar();
            await this.autoSelectToday();
            this.startAutoRefresh();

            console.log('✅ StatisticsManager: Initialization complete');
        } catch (error) {
            console.error('❌ StatisticsManager: Initialization error:', error);
            this.showError(`Initialization failed: ${error.message}`);
        }
    }

    // ==================== AUTO-REFRESH MANAGEMENT ====================

    startAutoRefresh() {
        console.log('🔄 Setting up auto-refresh (10 second intervals)');

        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            console.log(`👁️ Page visibility: ${this.isPageVisible ? 'visible' : 'hidden'}`);

            if (this.isPageVisible && this.autoRefreshEnabled) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });

        this.stopAutoRefresh();

        if (this.isPageVisible && this.autoRefreshEnabled) {
            this.autoRefreshInterval = setInterval(() => this.refreshCurrentData(), 10000);
            console.log('✅ Auto-refresh started');
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
        const refreshBtn = document.getElementById('refreshStatsBtn');

        if (!refreshBtn) return;

        const originalText = refreshBtn.textContent;
        this.setButtonState(refreshBtn, '🔄 Refreshing...', true);

        try {
            await this.refreshCurrentData();
            await this.updateCalendar();
            this.showNotification('✅ Statistics refreshed!', 'success');
        } catch (error) {
            console.error('❌ Error during manual refresh:', error);
            this.showNotification('❌ Refresh failed', 'error');
        } finally {
            setTimeout(() => this.setButtonState(refreshBtn, originalText, false), 1000);
        }
    }

    async refreshCurrentData() {
        if (!this.selectedDate) {
            console.log('⏭️ No date selected, skipping refresh');
            return;
        }

        const dateStr = this.getLocalDateString(this.selectedDate);
        console.log(`🔄 Refreshing data for ${dateStr}...`);

        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            const newData = result[`data_${dateStr}`] || {};

            if (JSON.stringify(this.currentData) !== JSON.stringify(newData)) {
                console.log('📊 Data has changed, updating display');
                this.currentData = newData;
                this.displayDataOrNoDataMessage();
                await this.updateCalendar();

                if (this.autoRefreshEnabled) {
                    this.showRefreshNotification();
                }
            }
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
        }
    }

    showRefreshNotification() {
        this.showNotification('🔄 Data updated', 'success', 2000);
    }

    // ==================== EVENT LISTENERS ====================

    setupEventListeners() {
        this.setupTrackingControls();
        this.setupRefreshControls();
        this.setupAutoResumeControls();
        this.setupCalendarControls();
        this.setupTableControls();
        this.setupWindowEvents();
        this.checkExistingAutoResumeTimer();
    }

    setupTrackingControls() {
        const trackingToggle = document.getElementById('trackingToggle');
        if (!trackingToggle) {
            console.warn('⚠️ trackingToggle element not found');
            return;
        }

        trackingToggle.addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;
            console.log(`🔄 Tracking toggle changed: ${isEnabled}`);

            if (isEnabled) {
                await this.enableTracking();
                this.hideAutoResumeContainer();
                this.stopAutoResumeTimer();
            } else {
                await this.disableTracking(10);
                this.showAutoResumeContainer();
                this.startAutoResumeTimer(10);
            }

            this.updateToggleLabel(isEnabled);
        });
    }

    setupRefreshControls() {
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        const refreshStatsBtn = document.getElementById('refreshStatsBtn');

        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.toggleAutoRefresh(e.target.checked);
            });
        }

        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', () => this.manualRefreshStats());
        }
    }

    setupAutoResumeControls() {
        const cancelAutoResumeBtn = document.getElementById('cancelAutoResume');
        if (cancelAutoResumeBtn) {
            cancelAutoResumeBtn.addEventListener('click', () => this.cancelAutoResume());
        }
    }

    setupCalendarControls() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (prevBtn) prevBtn.addEventListener('click', () => this.changeMonth(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changeMonth(1));
    }

    setupTableControls() {
        const expandBtn = document.getElementById('expandListBtn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.toggleUrlList());
        }
    }

    setupWindowEvents() {
        window.addEventListener('popstate', () => this.updateFromUrl());
        window.addEventListener('beforeunload', () => {
            this.stopAutoRefresh();
            this.stopAutoResumeTimer();
        });
    }

    // ==================== TRACKING STATE MANAGEMENT ====================

    async loadTrackingState() {
        try {
            console.log('📡 Loading tracking state...');
            const response = await chrome.runtime.sendMessage({ action: 'getTrackingState' });
            console.log('📡 Tracking state response:', response);

            const trackingToggle = document.getElementById('trackingToggle');
            if (!trackingToggle || !response) return;

            const isTracking = response.isTracking !== false;
            trackingToggle.checked = isTracking;
            this.updateToggleLabel(isTracking);

            if (!isTracking) {
                await this.handleDisabledTrackingState();
            } else {
                this.hideAutoResumeContainer();
            }
        } catch (error) {
            console.error('❌ Error loading tracking state:', error);
        }
    }

    async handleDisabledTrackingState() {
        this.showAutoResumeContainer();

        const result = await chrome.storage.local.get(['autoResumeTimer']);
        const timerData = result.autoResumeTimer;

        if (timerData?.active) {
            console.log('⏰ Active timer found, will be restored');
        } else {
            this.showResetAutoResumeState();
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

    // ==================== AUTO-RESUME TIMER MANAGEMENT ====================

    async startAutoResumeTimer(minutes) {
        console.log(`⏰ Starting auto-resume timer for ${minutes} minutes`);

        const endTime = Date.now() + (minutes * 60 * 1000);

        await chrome.storage.local.set({
            autoResumeTimer: {
                endTime: endTime,
                active: true,
                startTime: Date.now()
            }
        });

        this.showAutoResumeTimer();
        this.startTimerCountdown(endTime);

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

        this.stopAutoResumeTimer();

        this.countdownInterval = setInterval(() => {
            const remaining = endTime - Date.now();

            if (remaining <= 0) {
                this.onAutoResumeComplete();
                return;
            }

            const minutes = Math.floor(remaining / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    showAutoResumeTimer() {
        this.updateAutoResumeUI(true, 'Cancel Auto-Resume');
    }

    showResetAutoResumeState() {
        this.updateAutoResumeUI(false, 'Enable Auto-Resume');
        const timerElement = document.getElementById('timerCountdown');
        if (timerElement) timerElement.textContent = '10:00';
        this.stopAutoResumeTimer();
    }

    updateAutoResumeUI(isActive, buttonText) {
        const timerContainer = document.getElementById('autoResumeTimer');
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        const cancelBtn = document.getElementById('cancelAutoResume');
        const autoResumeOption = document.querySelector('.auto-resume-option');
        const autoResumeCheckbox = document.getElementById('autoResumeCheckbox');

        if (autoResumeContainer) autoResumeContainer.style.display = 'block';
        if (timerContainer) timerContainer.style.display = 'flex';
        if (autoResumeOption) autoResumeOption.style.display = 'none';
        if (cancelBtn) cancelBtn.textContent = buttonText;
        if (autoResumeCheckbox) autoResumeCheckbox.checked = true;
    }

    showAutoResumeContainer() {
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        if (autoResumeContainer) autoResumeContainer.style.display = 'block';
    }

    hideAutoResumeContainer() {
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        if (autoResumeContainer) autoResumeContainer.style.display = 'none';
    }

    async cancelAutoResume() {
        console.log('🚫 Cancelling/toggling auto-resume timer');

        const cancelBtn = document.getElementById('cancelAutoResume');
        const currentText = cancelBtn?.textContent || '';

        if (currentText === 'Enable Auto-Resume') {
            console.log('▶️ Enabling auto-resume timer');
            this.startAutoResumeTimer(10);
            this.showNotification('⏰ Auto-resume enabled - tracking will resume in 10 minutes', 'info');
        } else {
            console.log('⏹️ Cancelling auto-resume timer');
            await this.cancelActiveTimer();
            this.showResetAutoResumeState();
            this.showNotification('⏹️ Auto-resume cancelled', 'info');
        }
    }

    async cancelActiveTimer() {
        this.stopAutoResumeTimer();
        await chrome.storage.local.remove(['autoResumeTimer']);

        try {
            await chrome.runtime.sendMessage({ action: 'cancelAutoResumeTimer' });
        } catch (error) {
            console.error('❌ Error cancelling background timer:', error);
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

        this.stopAutoResumeTimer();
        await chrome.storage.local.remove(['autoResumeTimer']);
        await this.enableTracking();

        const trackingToggle = document.getElementById('trackingToggle');
        if (trackingToggle) trackingToggle.checked = true;

        this.updateToggleLabel(true);
        this.hideAutoResumeContainer();
        this.showNotification('🔄 Tracking automatically resumed!', 'success');
    }

    async checkExistingAutoResumeTimer() {
        try {
            const result = await chrome.storage.local.get(['autoResumeTimer']);
            const timerData = result.autoResumeTimer;

            if (!timerData?.active) return;

            const trackingResponse = await chrome.runtime.sendMessage({ action: 'getTrackingState' });
            const isTracking = trackingResponse?.isTracking !== false;

            if (!isTracking) {
                const remaining = timerData.endTime - Date.now();

                if (remaining > 0) {
                    console.log('⏰ Found existing auto-resume timer with', Math.floor(remaining / 1000), 'seconds remaining');
                    this.showAutoResumeTimer();
                    this.startTimerCountdown(timerData.endTime);
                } else {
                    console.log('⏰ Existing timer has expired, cleaning up');
                    await chrome.storage.local.remove(['autoResumeTimer']);
                    this.showResetAutoResumeState();
                }
            } else {
                console.log('⏰ Tracking is enabled, removing stale auto-resume timer');
                await chrome.storage.local.remove(['autoResumeTimer']);
            }
        } catch (error) {
            console.error('❌ Error checking existing timer:', error);
        }
    }

    // ==================== CALENDAR MANAGEMENT ====================

    async autoSelectToday() {
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');

        if (!dateParam) {
            console.log('📅 Auto-selecting today');
            await this.selectDate(new Date());
        } else {
            console.log('📅 URL has date parameter, using that instead');
            this.updateFromUrl();
        }
    }

    changeMonth(direction) {
        const newDate = new Date(this.currentDate);
        newDate.setMonth(newDate.getMonth() + direction);

        if (!this.isValidMonthNavigation(newDate)) return;

        this.currentDate = newDate;
        this.selectedDate = null;

        const now = new Date();
        const isCurrentMonth = newDate.getFullYear() === now.getFullYear() &&
                              newDate.getMonth() === now.getMonth();

        if (isCurrentMonth) {
            this.selectedDate = now;
            this.updateUrl();
            this.updateCalendar();
            this.loadDataForDate();
        } else {
            this.updateCalendar();
            this.updateUrl();
            this.showNoDataMessage();
        }
    }

    isValidMonthNavigation(newDate) {
        const now = new Date();
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

        // Don't allow going before 2 months ago
        if (newDate.getFullYear() < twoMonthsAgo.getFullYear() ||
            (newDate.getFullYear() === twoMonthsAgo.getFullYear() && newDate.getMonth() < twoMonthsAgo.getMonth())) {
            console.log('📅 Cannot navigate before 2 months ago');
            return false;
        }

        // Don't allow going beyond current month
        if (newDate.getFullYear() > now.getFullYear() ||
            (newDate.getFullYear() === now.getFullYear() && newDate.getMonth() > now.getMonth())) {
            console.log('📅 Cannot navigate beyond current month');
            return false;
        }

        return true;
    }

    async updateCalendar() {
        console.log('📅 Updating calendar...');

        const monthElement = document.getElementById('currentMonth');
        const calendarElement = document.getElementById('calendar');

        if (!monthElement || !calendarElement) {
            console.error('❌ Calendar elements not found');
            return;
        }

        monthElement.textContent = this.currentDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        this.updateNavigationButtons();
        await this.generateCalendarGrid(calendarElement);
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (!prevBtn || !nextBtn) return;

        const now = new Date();
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const prevMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
        const nextMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);

        prevBtn.disabled = prevMonth.getFullYear() < twoMonthsAgo.getFullYear() ||
                          (prevMonth.getFullYear() === twoMonthsAgo.getFullYear() &&
                           prevMonth.getMonth() < twoMonthsAgo.getMonth());

        nextBtn.disabled = nextMonth.getFullYear() > now.getFullYear() ||
                          (nextMonth.getFullYear() === now.getFullYear() &&
                           nextMonth.getMonth() > now.getMonth());
    }

    async generateCalendarGrid(container) {
        console.log('📅 Generating calendar grid...');
        container.innerHTML = '';

        // Add day headers
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'calendar-header-cell';
            headerCell.textContent = day;
            container.appendChild(headerCell);
        });

        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const today = new Date();
        const todayStr = this.getLocalDateString(today);

        // Add empty cells for days before month start
        for (let i = 0; i < firstDay.getDay(); i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day disabled';
            container.appendChild(emptyCell);
        }

        // Add calendar days
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayElement = await this.createCalendarDay(day, todayStr, today);
            container.appendChild(dayElement);
        }

        console.log('📅 Calendar grid generated');
    }

    async createCalendarDay(day, todayStr, today) {
        const dayElement = document.createElement('button');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;

        const cellDate = this.createDateFromCalendarDay(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth(),
            day
        );
        const dateStr = this.getLocalDateString(cellDate);

        // Check if date has data
        if (await this.hasDataForDate(dateStr)) {
            dayElement.classList.add('has-data');
        }

        // Handle future dates
        const isToday = dateStr === todayStr;
        if (cellDate > today && !isToday) {
            dayElement.classList.add('future');
            dayElement.disabled = true;
        } else {
            dayElement.addEventListener('click', () => this.selectDate(cellDate));
        }

        // Handle selected date
        if (this.selectedDate && cellDate.toDateString() === this.selectedDate.toDateString()) {
            dayElement.classList.add('selected');
        }

        return dayElement;
    }

    async hasDataForDate(dateStr) {
        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            const data = result[`data_${dateStr}`];
            return data && Object.keys(data).length > 0;
        } catch (error) {
            console.error('❌ Error checking data for date:', error);
            return false;
        }
    }

    async selectDate(date) {
        console.log('🎯 Selecting date:', date);
        this.selectedDate = date;
        this.updateUrl();
        await this.loadDataForDate();
        await this.updateCalendar();
    }

    // ==================== DATA LOADING AND DISPLAY ====================

    async loadDataForDate() {
        if (!this.selectedDate) {
            this.showNoDataMessage();
            return;
        }

        const dateStr = this.getLocalDateString(this.selectedDate);
        console.log('📥 Loading data for date:', dateStr);

        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            this.currentData = result[`data_${dateStr}`] || {};

            console.log('📊 Loaded data for', dateStr, '- URLs:', Object.keys(this.currentData).length);
            this.displayDataOrNoDataMessage();
        } catch (error) {
            console.error('❌ Error loading data for date:', error);
            this.showNoDataMessage();
        }
    }

    displayDataOrNoDataMessage() {
        if (Object.keys(this.currentData).length === 0) {
            this.showNoDataMessage();
        } else {
            this.displayStatistics();
        }
    }

    showNoDataMessage() {
        this.toggleStatisticsDisplay(false);
        const noDataMessage = document.getElementById('noDataMessage');
        if (noDataMessage) {
            noDataMessage.style.display = 'block';
            noDataMessage.innerHTML = '<p>No viewing data available for this date.</p>';
        }
    }

    displayStatistics() {
        this.toggleStatisticsDisplay(true);
        this.updateSelectedDateDisplay();
        this.showingAllUrls = false;
        this.updateTable();
        this.updateChart();
    }

    toggleStatisticsDisplay(showStatistics) {
        const noDataMessage = document.getElementById('noDataMessage');
        const statisticsContent = document.getElementById('statisticsContent');

        if (noDataMessage) noDataMessage.style.display = showStatistics ? 'none' : 'block';
        if (statisticsContent) statisticsContent.style.display = showStatistics ? 'block' : 'none';
    }

    updateSelectedDateDisplay() {
        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement && this.selectedDate) {
            selectedDateElement.textContent = `Statistics for ${this.selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`;
        }
    }

    // ==================== TABLE MANAGEMENT ====================

    updateTable() {
        const tbody = document.getElementById('statisticsTableBody');
        const expandBtn = document.getElementById('expandListBtn');

        if (!tbody) {
            console.error('❌ Table body not found');
            return;
        }

        tbody.innerHTML = '';

        const sortedEntries = Object.entries(this.currentData)
            .sort(([,a], [,b]) => b - a);

        const entriesToShow = this.showingAllUrls ? sortedEntries : sortedEntries.slice(0, 20);

        entriesToShow.forEach(([url, timeMs]) => {
            const row = this.createTableRow(url, timeMs);
            tbody.appendChild(row);
        });

        this.updateExpandButton(expandBtn, sortedEntries.length);
        console.log(`✅ Table updated with ${entriesToShow.length} entries`);
    }

    createTableRow(url, timeMs) {
        const row = document.createElement('tr');

        const urlCell = document.createElement('td');
        urlCell.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        row.appendChild(urlCell);

        const timeCell = document.createElement('td');
        timeCell.textContent = this.formatTime(timeMs);
        row.appendChild(timeCell);

        return row;
    }

    updateExpandButton(expandBtn, totalEntries) {
        if (!expandBtn) return;

        if (totalEntries > 20) {
            expandBtn.style.display = 'block';
            expandBtn.textContent = this.showingAllUrls ? 'Show Top 20' : 'Show All URLs';
        } else {
            expandBtn.style.display = 'none';
        }
    }

    toggleUrlList() {
        this.showingAllUrls = !this.showingAllUrls;
        this.updateTable();
        this.updateChart();
    }

    // ==================== CHART MANAGEMENT ====================

    updateChart() {
        const canvas = document.getElementById('pieChart');
        const chartContainer = document.getElementById('chartContainer');

        if (!canvas || !chartContainer) {
            console.log('📊 Chart elements not found, skipping chart update');
            return;
        }

        if (this.showingAllUrls) {
            chartContainer.style.display = 'none';
            return;
        }

        chartContainer.style.display = 'block';
        this.destroyExistingChart();

        const chartData = this.prepareChartData();
        if (!chartData) {
            chartContainer.style.display = 'none';
            return;
        }

        if (chartData.isEmpty) {
            this.showChartMessage(chartData.message);
            return;
        }

        this.renderChart(canvas, chartData);
    }

    destroyExistingChart() {
        if (this.pieChart?.destroy) {
            this.pieChart.destroy();
        }
    }

    prepareChartData() {
        const sortedEntries = Object.entries(this.currentData)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);

        if (sortedEntries.length === 0) {
            console.log('📊 No data for chart');
            return null;
        }

        const totalTime = sortedEntries.reduce((sum, [,timeMs]) => sum + timeMs, 0);
        const filteredEntries = sortedEntries.filter(([,timeMs]) => {
            const percentage = (timeMs / totalTime) * 100;
            return percentage >= 1.0;
        });

        if (filteredEntries.length === 0) {
            return { isEmpty: true, message: 'No pages viewed for 1% or more of the time.' };
        }

        this.chartHiddenItems = this.chartHiddenItems || new Set();
        const visibleEntries = filteredEntries.filter(([url]) => !this.chartHiddenItems.has(url));

        if (visibleEntries.length === 0) {
            return { isEmpty: true, message: 'All chart entries are currently hidden. Click legend items to show them.' };
        }

        return {
            visibleEntries,
            filteredEntries,
            sortedEntries,
            totalTime,
            labels: visibleEntries.map(([url]) => this.shortenUrl(url)),
            data: visibleEntries.map(([,timeMs]) => timeMs),
            colors: this.generateDomainConsistentColors(visibleEntries),
            originalUrls: visibleEntries.map(([url]) => url)
        };
    }

    renderChart(canvas, chartData) {
        this.addPieChartHeading();
        this.addChartExplanation(chartData.filteredEntries.length, chartData.sortedEntries.length);

        if (typeof Chart === 'undefined') {
            console.warn('⚠️ Chart.js not available, hiding chart container');
            const chartContainer = document.getElementById('chartContainer');
            if (chartContainer) chartContainer.style.display = 'none';
            return;
        }

        const ctx = canvas.getContext('2d');
        this.pieChart = new Chart(ctx, this.getChartConfig(chartData));

        console.log('📊 Chart updated successfully with', chartData.visibleEntries.length, 'visible entries');
    }

    getChartConfig(chartData) {
        return {
            type: 'pie',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: chartData.colors,
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
                            font: { size: 12 },
                            generateLabels: (chart) => this.generateChartLabels(chart, chartData)
                        },
                        onClick: (e, legendItem) => {
                            if (legendItem.url) {
                                this.toggleChartItem(legendItem.url);
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => this.formatChartTooltip(context)
                        }
                    }
                },
                layout: {
                    padding: { top: 20, bottom: 20 }
                }
            }
        };
    }

    generateChartLabels(chart, chartData) {
        const data = chart.data;
        if (!data.labels.length || !data.datasets.length) return [];

        const allLabels = [];
        const visibleTotal = data.datasets[0].data.reduce((a, b) => a + b, 0);

        // Add visible entries
        data.labels.forEach((label, i) => {
            const dataset = data.datasets[0];
            const value = dataset.data[i];
            const percentage = ((value / visibleTotal) * 100).toFixed(1);
            const url = chartData.originalUrls[i];

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
        chartData.filteredEntries.forEach(([url]) => {
            if (this.chartHiddenItems.has(url)) {
                const timeMs = chartData.filteredEntries.find(([u]) => u === url)[1];
                const percentage = ((timeMs / chartData.totalTime) * 100).toFixed(1);
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

    formatChartTooltip(context) {
        const label = context.label || '';
        const value = this.formatTime(context.raw);
        const visibleTotal = context.dataset.data.reduce((a, b) => a + b, 0);
        const percentage = ((context.raw / visibleTotal) * 100).toFixed(1);
        return `${label}: ${value} (${percentage}%)`;
    }

    addPieChartHeading() {
        const existingHeading = document.getElementById('pieChartHeading');
        if (existingHeading) existingHeading.remove();

        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) return;

        const heading = document.createElement('h2');
        heading.id = 'pieChartHeading';
        heading.textContent = 'Pie chart';
        heading.style.cssText = `
            margin: 0 0 10px 0;
            color: #1a202c;
            font-size: 20px;
            font-weight: 600;
        `;

        chartContainer.insertBefore(heading, chartContainer.firstChild);
    }

    addChartExplanation(filteredCount, totalCount) {
        const existingExplanation = document.getElementById('chartExplanation');
        if (existingExplanation) existingExplanation.remove();

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

        const hiddenCount = this.chartHiddenItems?.size || 0;
        let explanationText = `Pages with at least 1% of viewing time (${filteredCount} of ${totalCount} pages).`;

        if (hiddenCount > 0) {
            explanationText += ` ${hiddenCount} entries are currently hidden.`;
        }

        explanationText += ` Click legend entries below the chart to exclude/include pages from the chart.`;
        explanation.textContent = explanationText;

        const canvas = document.getElementById('pieChart');
        chartContainer.insertBefore(explanation, canvas);
    }

    showChartMessage(message) {
        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) return;

        this.addPieChartHeading();

        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            text-align: center;
            padding: 40px 20px;
            color: #718096;
            font-style: italic;
            background: #f7fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        `;
        messageDiv.textContent = message;

        chartContainer.appendChild(messageDiv);
    }

    toggleChartItem(url) {
        this.chartHiddenItems = this.chartHiddenItems || new Set();

        if (this.chartHiddenItems.has(url)) {
            this.chartHiddenItems.delete(url);
            console.log('📊 Showing chart item:', this.shortenUrl(url));
        } else {
            this.chartHiddenItems.add(url);
            console.log('📊 Hiding chart item:', this.shortenUrl(url));
        }

        this.updateChart();
    }

    generateDomainConsistentColors(entries) {
        const colors = [];
        const domainColorMap = new Map();
        const colorPalette = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#C9CBCF', '#99FF99', '#FFB366', '#B366FF',
            '#FF99CC', '#66B2FF', '#FFFF99', '#FF6666', '#66CCFF'
        ];

        let colorIndex = 0;

        entries.forEach(([url]) => {
            let domain;
            try {
                domain = new URL(url).hostname;
            } catch {
                domain = url;
            }

            if (domainColorMap.has(domain)) {
                colors.push(domainColorMap.get(domain));
            } else {
                const color = colorPalette[colorIndex % colorPalette.length];
                domainColorMap.set(domain, color);
                colors.push(color);
                colorIndex++;
            }
        });

        // Ensure contrasting adjacent segments
        for (let i = 1; i < colors.length; i++) {
            if (colors[i] === colors[i - 1]) {
                const availableColors = colorPalette.filter(c => c !== colors[i - 1]);
                colors[i] = availableColors[i % availableColors.length];
            }
        }

        return colors;
    }

    // ==================== UTILITY FUNCTIONS ====================

    getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    createDateFromCalendarDay(year, month, day) {
        return new Date(year, month, day, 12, 0, 0);
    }

    shortenUrl(url) {
        try {
            const urlObj = new URL(url);
            let displayUrl = urlObj.hostname;

            if (urlObj.pathname && urlObj.pathname !== '/') {
                displayUrl += urlObj.pathname;
                if (displayUrl.length > 40) {
                    displayUrl = displayUrl.substring(0, 37) + '...';
                }
            }

            return displayUrl;
        } catch {
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

    setButtonState(button, text, disabled) {
        button.textContent = text;
        button.disabled = disabled;
    }

    showError(message) {
        const monthElement = document.getElementById('currentMonth');
        if (monthElement) {
            monthElement.textContent = `Error: ${message}`;
        }
    }

    showNotification(message, type = 'info', duration = 4000) {
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

        setTimeout(() => notification.style.opacity = '1', 100);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    updateUrl() {
        const url = new URL(window.location);
        if (this.selectedDate) {
            const dateStr = this.getLocalDateString(this.selectedDate);
            url.searchParams.set('date', dateStr);
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

// ==================== INITIALIZATION ====================

let statsManager;

function initializeWhenReady() {
    if (document.readyState === 'loading') {
        console.log('📊 DOM still loading, waiting...');
        document.addEventListener('DOMContentLoaded', initializeStatsManager);
    } else {
        console.log('📊 DOM already loaded');
        initializeStatsManager();
    }
}

function initializeStatsManager() {
    console.log('🚀 Initializing StatisticsManager...');

    const requiredElements = ['currentMonth', 'calendar', 'trackingToggle'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
        console.error('❌ Missing required elements:', missingElements);
        return;
    }

    try {
        statsManager = new StatisticsManager();
        window.statsManager = statsManager;
        console.log('✅ StatisticsManager initialized and exposed globally');
    } catch (error) {
        console.error('❌ Failed to create StatisticsManager:', error);
    }
}

initializeWhenReady();
