class StatisticsManager {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.currentData = null;
        this.showingAllUrls = false;
        this.pieChart = null;
        
        console.log('StatisticsManager: Initializing...');
        this.init();
    }

    async init() {
        try {
            console.log('StatisticsManager: Setting up event listeners...');
            this.setupEventListeners();
            
            console.log('StatisticsManager: Loading tracking state...');
            await this.loadTrackingState();
            
            console.log('StatisticsManager: Updating calendar...');
            this.updateCalendar();
            
            console.log('StatisticsManager: Updating from URL...');
            this.updateFromUrl();
            
            console.log('StatisticsManager: Debugging storage data...');
            await this.debugStorageData();
            
            console.log('StatisticsManager: Initialization complete');
        } catch (error) {
            console.error('StatisticsManager: Initialization error:', error);
        }
    }

    async debugStorageData() {
        try {
            const allData = await chrome.storage.local.get(null);
            console.log('📊 All storage data:', allData);
            
            // Check today's data specifically
            const today = new Date().toISOString().split('T')[0];
            const todayKey = `data_${today}`;
            console.log(`📅 Today's key: ${todayKey}`);
            console.log(`📈 Today's data:`, allData[todayKey]);
            
            // List all data keys
            const dataKeys = Object.keys(allData).filter(key => key.startsWith('data_'));
            console.log('🗂️ Available data keys:', dataKeys);
            
            return allData;
        } catch (error) {
            console.error('❌ Error checking storage data:', error);
            return {};
        }
    }

    setupEventListeners() {
        // Tracking toggle
        const trackingToggle = document.getElementById('trackingToggle');
        const autoResumeCheckbox = document.getElementById('autoResumeCheckbox');
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        
        if (trackingToggle) {
            trackingToggle.addEventListener('change', async (e) => {
                const isEnabled = e.target.checked;
                const autoResume = autoResumeCheckbox?.checked || false;
                
                console.log(`🔄 Tracking toggle changed: ${isEnabled}, auto-resume: ${autoResume}`);
                
                if (isEnabled) {
                    await this.enableTracking();
                    if (autoResumeContainer) autoResumeContainer.style.display = 'none';
                } else {
                    await this.disableTracking(autoResume ? 30 : 0);
                    if (autoResumeContainer) autoResumeContainer.style.display = autoResume ? 'none' : 'block';
                }
                
                this.updateToggleLabel(isEnabled);
            });
        }

        // Calendar navigation
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
        
        if (prevBtn) prevBtn.addEventListener('click', () => this.changeMonth(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changeMonth(1));

        // Expand list button
        const expandBtn = document.getElementById('expandListBtn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.toggleUrlList());
        }

        // Handle URL parameter changes
        window.addEventListener('popstate', () => this.updateFromUrl());

        // Add debug button for testing
        this.addDebugButton();
    }

    addDebugButton() {
        const header = document.querySelector('header');
        if (!header) {
            console.error('❌ Header element not found');
            return;
        }
        
        const debugBtn = document.createElement('button');
        debugBtn.textContent = 'Add Test Data';
        debugBtn.style.cssText = `
            margin-left: 10px;
            padding: 8px 12px;
            background: #e53e3e;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        debugBtn.addEventListener('click', async () => {
            console.log('🧪 Debug button clicked');
            await this.addTestData();
        });
        
        header.appendChild(debugBtn);
        console.log('🔧 Debug button added');
    }

    async addTestData() {
        try {
            console.log('🧪 Adding test data...');
            
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
            
            console.log('💾 Saving test data:', { [storageKey]: testData });
            
            await chrome.storage.local.set({ [storageKey]: testData });
            
            console.log('✅ Test data saved successfully');
            
            // Verify the data was saved
            const verification = await chrome.storage.local.get([storageKey]);
            console.log('🔍 Verification - saved data:', verification);
            
            alert('✅ Test data added successfully! Click today\'s date to see the statistics.');
            
            // Refresh the calendar to show today has data
            await this.updateCalendar();
            
            // Auto-select today's date
            const today_date = new Date();
            await this.selectDate(today_date);
            
        } catch (error) {
            console.error('❌ Error adding test data:', error);
            alert('❌ Error adding test data. Check the console for details.');
        }
    }

    async loadTrackingState() {
        try {
            console.log('📡 Sending message to background script...');
            const response = await chrome.runtime.sendMessage({ action: 'getTrackingState' });
            console.log('📡 Tracking state response:', response);
            
            const trackingToggle = document.getElementById('trackingToggle');
            if (trackingToggle && response) {
                trackingToggle.checked = response.isTracking;
                this.updateToggleLabel(response.isTracking);
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

    changeMonth(direction) {
        const newDate = new Date(this.currentDate);
        newDate.setMonth(newDate.getMonth() + direction);
        
        // Don't allow navigation beyond 2 months ago
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        twoMonthsAgo.setDate(1);
        
        if (newDate < twoMonthsAgo) {
            return;
        }
        
        // Don't allow navigation to future months
        const now = new Date();
        if (newDate.getFullYear() > now.getFullYear() || 
            (newDate.getFullYear() === now.getFullYear() && newDate.getMonth() > now.getMonth())) {
            return;
        }
        
        this.currentDate = newDate;
        this.selectedDate = null;
        this.updateCalendar();
        this.updateUrl();
        this.showNoDataMessage();
    }

    updateCalendar() {
        console.log('📅 Updating calendar...');
        
        const monthElement = document.getElementById('currentMonth');
        const calendarElement = document.getElementById('calendar');
        
        if (!monthElement || !calendarElement) {
            console.error('❌ Calendar elements not found');
            return;
        }
        
        // Update month display
        const monthName = this.currentDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
        monthElement.textContent = monthName;
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        // Generate calendar
        this.generateCalendarGrid(calendarElement);
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
        
        if (!prevBtn || !nextBtn) return;
        
        // Check if we can go back (2 months max)
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const prevMonth = new Date(this.currentDate);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        
        prevBtn.disabled = prevMonth < twoMonthsAgo;
        
        // Check if we can go forward (not beyond current month)
        const now = new Date();
        const nextMonth = new Date(this.currentDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        nextBtn.disabled = nextMonth.getFullYear() > now.getFullYear() || 
                          (nextMonth.getFullYear() === now.getFullYear() && nextMonth.getMonth() > now.getMonth());
    }

    async generateCalendarGrid(container) {
        console.log('📅 Generating calendar grid...');
        container.innerHTML = '';
        
        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'calendar-header-cell';
            headerCell.textContent = day;
            container.appendChild(headerCell);
        });
        
        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const today = new Date();
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay.getDay(); i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day disabled';
            container.appendChild(emptyCell);
        }
        
        // Add days of the month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayElement = document.createElement('button');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            const cellDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const dateStr = cellDate.toISOString().split('T')[0];
            
            // Check if this day has data
            const hasData = await this.hasDataForDate(dateStr);
            if (hasData) {
                dayElement.classList.add('has-data');
                console.log(`📊 Day ${day} has data`);
            } else {
                console.log(`📊 Day ${day} has no data`);
            }
            
            // Mark future days as disabled
            if (cellDate > today) {
                dayElement.classList.add('future');
                dayElement.disabled = true;
            } else {
                dayElement.addEventListener('click', () => {
                    console.log(`🎯 Clicked on day ${day}`);
                    this.selectDate(cellDate);
                });
            }
            
            // Highlight selected date
            if (this.selectedDate && 
                cellDate.toDateString() === this.selectedDate.toDateString()) {
                dayElement.classList.add('selected');
            }
            
            container.appendChild(dayElement);
        }
    }

    async hasDataForDate(dateStr) {
        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            const data = result[`data_${dateStr}`];
            const hasData = data && Object.keys(data).length > 0;
            console.log(`🔍 Checking data for ${dateStr}:`, data, 'Has data:', hasData);
            return hasData;
        } catch (error) {
            console.error('❌ Error checking data for date:', error);
            return false;
        }
    }

    async selectDate(date) {
        console.log('🎯 Selected date:', date);
        this.selectedDate = date;
        this.updateUrl();
        await this.loadDataForDate();
        this.updateCalendar(); // Refresh to show selection
    }

    async loadDataForDate() {
        if (!this.selectedDate) return;
        
        const dateStr = this.selectedDate.toISOString().split('T')[0];
        console.log('📥 Loading data for date:', dateStr);
        
        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            this.currentData = result[`data_${dateStr}`] || {};
            
            console.log('📊 Loaded data:', this.currentData);
            
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
        
        if (noDataMessage) noDataMessage.style.display = 'block';
        if (statisticsContent) statisticsContent.style.display = 'none';
        
        console.log('💭 Showing no data message');
    }

    displayStatistics() {
        const noDataMessage = document.getElementById('noDataMessage');
        const statisticsContent = document.getElementById('statisticsContent');
        
        if (noDataMessage) noDataMessage.style.display = 'none';
        if (statisticsContent) statisticsContent.style.display = 'block';
        
        // Update selected date display
        const selectedDateElement = document.getElementById('selectedDate');
        if (selectedDateElement) {
            selectedDateElement.textContent = `Statistics for ${this.selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`;
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
        
        // Sort URLs by time spent (descending)
        const sortedEntries = Object.entries(this.currentData)
            .sort(([,a], [,b]) => b - a);
        
        tbody.innerHTML = '';
        
        // Determine how many entries to show
        const entriesToShow = this.showingAllUrls ? sortedEntries : sortedEntries.slice(0, 20);
        
        entriesToShow.forEach(([url, timeMs]) => {
            const row = document.createElement('tr');
            
            const urlCell = document.createElement('td');
            urlCell.textContent = url;
            row.appendChild(urlCell);
            
            const timeCell = document.createElement('td');
            timeCell.textContent = this.formatTime(timeMs);
            row.appendChild(timeCell);
            
            tbody.appendChild(row);
        });
        
        // Show/hide expand button
        if (expandBtn) {
            if (sortedEntries.length > 20) {
                expandBtn.style.display = 'block';
                expandBtn.textContent = this.showingAllUrls ? 'Show Top 20' : 'Show All URLs';
            } else {
                expandBtn.style.display = 'none';
            }
        }
        
        console.log(`📊 Table updated with ${entriesToShow.length} entries`);
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
        
        // Hide chart if showing all URLs
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
        
        // Prepare data for chart
        const sortedEntries = Object.entries(this.currentData)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);
        
        const labels = sortedEntries.map(([url]) => this.shortenUrl(url));
        const data = sortedEntries.map(([,timeMs]) => timeMs);
        const colors = this.generateColors(sortedEntries.length);
        
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
                        borderColor: '#ffffff'
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
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = this.formatTime(context.raw);
                                    return `${label}: ${value}`;
                                }
                            }
                        }
                    }
                }
            });
            
            console.log('📊 Chart updated successfully');
        } else {
            console.warn('⚠️ Chart.js not available, skipping chart');
        }
    }

    shortenUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname;
        } catch {
            return url;
        }
    }

    generateColors(count) {
        const colors = [];
        const hueStep = 360 / count;
        
        for (let i = 0; i < count; i++) {
            const hue = (i * hueStep) % 360;
            const saturation = 60 + (i % 2) * 20;
            const lightness = 50 + (i % 3) * 10;
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
        
        return colors;
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
            const dateStr = this.selectedDate.toISOString().split('T')[0];
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
            const date = new Date(dateParam + 'T00:00:00');
            if (!isNaN(date.getTime())) {
                this.selectedDate = date;
                this.currentDate = new Date(date.getFullYear(), date.getMonth(), 1);
                this.updateCalendar();
                this.loadDataForDate();
                return;
            }
        }
        
        this.showNoDataMessage();
    }
}

// Initialize the statistics manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing StatisticsManager...');
    new StatisticsManager();
});