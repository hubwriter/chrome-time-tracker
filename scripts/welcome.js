document.addEventListener('DOMContentLoaded', function() {
    const getStartedBtn = document.getElementById('getStartedBtn');
    
    getStartedBtn.addEventListener('click', function() {
        // Close the welcome tab and open statistics page
        const statisticsUrl = chrome.runtime.getURL('pages/statistics.html');
        chrome.tabs.create({ url: statisticsUrl }, function() {
            window.close();
        });
    });
});