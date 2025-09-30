// Quick fix for the calendar - add this to statistics.js in the generateCalendarGrid method
// Replace the future day check with this:

// Mark future days as disabled (but not today)
const cellDateStr = cellDate.toISOString().split('T')[0];
const todayStr = new Date().toISOString().split('T')[0];

if (cellDate > today && cellDateStr !== todayStr) {
    dayElement.classList.add('future');
    dayElement.disabled = true;
} else {
    dayElement.addEventListener('click', () => {
        console.log(`🎯 Clicked on day ${day}`);
        this.selectDate(cellDate);
    });
}