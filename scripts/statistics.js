class StatisticsManager {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.currentData = null;
        this.showingAllUrls = false;
        this.pieChart = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadTrackingState();
        this.updateCalendar();
        this.updateFromUrl();
    }

    setupEventListeners() {
        // Tracking toggle
        const trackingToggle = document.getElementById('trackingToggle');
        const autoResumeCheckbox = document.getElementById('autoResumeCheckbox');
        const autoResumeContainer = document.getElementById('autoResumeContainer');
        
        trackingToggle.addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;
            const autoResume = autoResumeCheckbox.checked;
            
            if (isEnabled) {
                await this.enableTracking();
                autoResumeContainer.style.display = 'none';
            } else {
                await this.disableTracking(autoResume ? 30 : 0);
                autoResumeContainer.style.display = autoResume ? 'none' : 'block';
            }
            
            this.updateToggleLabel(isEnabled);
        });

        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.changeMonth(-1);
        });
        
        document.getElementById('nextMonth').addEventListener('click', () => {
            this.changeMonth(1);
        });

        // Expand list button
        document.getElementById('expandListBtn').addEventListener('click', () => {
            this.toggleUrlList();
        });

        // Handle URL parameter changes
        window.addEventListener('popstate', () => {
            this.updateFromUrl();
        });
    }

    async loadTrackingState() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTrackingState' });
            const trackingToggle = document.getElementById('trackingToggle');
            trackingToggle.checked = response.isTracking;
            this.updateToggleLabel(response.isTracking);
        } catch (error) {
            console.error('Error loading tracking state:', error);
        }
    }

    updateToggleLabel(isEnabled) {
        const label = document.querySelector('.toggle-label');
        label.textContent = isEnabled ? 'Tracking Enabled' : 'Tracking Disabled';
    }

    async enableTracking() {
        try {
            await chrome.runtime.sendMessage({ action: 'enableTracking' });
        } catch (error) {
            console.error('Error enabling tracking:', error);
        }
    }

    async disableTracking(autoResumeMinutes = 0) {
        try {
            await chrome.runtime.sendMessage({ 
                action: 'disableTracking', 
                autoResumeMinutes 
            });
        } catch (error) {
            console.error('Error disabling tracking:', error);
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
        const monthElement = document.getElementById('currentMonth');
        const calendarElement = document.getElementById('calendar');
        
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
            }
            
            // Mark future days as disabled
            if (cellDate > today) {
                dayElement.classList.add('future');
                dayElement.disabled = true;
            } else {
                dayElement.addEventListener('click', () => {
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
            return result[`data_${dateStr}`] && Object.keys(result[`data_${dateStr}`]).length > 0;
        } catch (error) {
            console.error('Error checking data for date:', error);
            return false;
        }
    }

    async selectDate(date) {
        this.selectedDate = date;
        this.updateUrl();
        await this.loadDataForDate();
        this.updateCalendar(); // Refresh to show selection
    }

    async loadDataForDate() {
        if (!this.selectedDate) return;
        
        const dateStr = this.selectedDate.toISOString().split('T')[0];
        
        try {
            const result = await chrome.storage.local.get([`data_${dateStr}`]);
            this.currentData = result[`data_${dateStr}`] || {};
            
            if (Object.keys(this.currentData).length === 0) {
                this.showNoDataMessage();
            } else {
                this.displayStatistics();
            }
        } catch (error) {
            console.error('Error loading data for date:', error);
            this.showNoDataMessage();
        }
    }

    showNoDataMessage() {
        document.getElementById('noDataMessage').style.display = 'block';
        document.getElementById('statisticsContent').style.display = 'none';
    }

    displayStatistics() {
        document.getElementById('noDataMessage').style.display = 'none';
        document.getElementById('statisticsContent').style.display = 'block';
        
        // Update selected date display
        const selectedDateElement = document.getElementById('selectedDate');
        selectedDateElement.textContent = `Statistics for ${this.selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })}`;
        
        this.showingAllUrls = false;
        this.updateTable();
        this.updateChart();
    }

    updateTable() {
        const tbody = document.getElementById('statisticsTableBody');
        const expandBtn = document.getElementById('expandListBtn');
        
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
        if (sortedEntries.length > 20) {
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

    updateChart() {
        const ctx = document.getElementById('pieChart').getContext('2d');
        const chartContainer = document.getElementById('chartContainer');
        
        // Hide chart if showing all URLs
        if (this.showingAllUrls) {
            chartContainer.style.display = 'none';
            return;
        } else {
            chartContainer.style.display = 'block';
        }
        
        // Destroy existing chart
        if (this.pieChart) {
            this.pieChart.destroy();
        }
        
        // Prepare data for chart
        const sortedEntries = Object.entries(this.currentData)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);
        
        const labels = sortedEntries.map(([url]) => this.shortenUrl(url));
        const data = sortedEntries.map(([,timeMs]) => timeMs);
        const colors = this.generateColors(sortedEntries.length);
        
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
        // Generate a consistent color for each domain
        const colors = [];
        const hueStep = 360 / count;
        
        for (let i = 0; i < count; i++) {
            const hue = (i * hueStep) % 360;
            // Vary saturation and lightness to ensure adjacent colors are different
            const saturation = 60 + (i % 2) * 20; // 60% or 80%
            const lightness = 50 + (i % 3) * 10;  // 50%, 60%, or 70%
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
    new StatisticsManager();
});