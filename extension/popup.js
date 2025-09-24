// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const groupBtn = document.getElementById('groupBtn');
    const ungroupBtn = document.getElementById('ungroupBtn');
    const loading = document.getElementById('loading');
    const toggle = document.getElementById('enable-filter');

    const result = await chrome.storage.sync.get(['autoCleanEnabled']);
    toggle.checked = result.autoCleanEnabled || false;


    
    // Elements for stats
    const totalTabsEl = document.getElementById('totalTabs');
    const totalGroupsEl = document.getElementById('totalGroups');
    const groupedTabsEl = document.getElementById('groupedTabs');
    const ungroupedTabsEl = document.getElementById('ungroupedTabs');
    
    // Show loading
    function showLoading() {
        loading.style.display = 'block';
        groupBtn.disabled = true;
        ungroupBtn.disabled = true;
    }
    
    // Hide loading
    function hideLoading() {
        loading.style.display = 'none';
        groupBtn.disabled = false;
        ungroupBtn.disabled = false;
    }

    // Toggle auto clean tabs
    toggle.addEventListener('change', () => {
        chrome.runtime.sendMessage({
            action: 'setAutoClean',
            enabled: toggle.checked
        });
    });
    
    // Update stats
    async function updateStats() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTabStats' });
            if (response.success) {
                const stats = response.data;
                totalTabsEl.textContent = stats.totalTabs;
                totalGroupsEl.textContent = stats.totalGroups;
                groupedTabsEl.textContent = stats.groupedTabs;
                ungroupedTabsEl.textContent = stats.ungroupedTabs;
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }
    
    // Group tabs
    async function groupTabs() {
        showLoading();
        try {
            const response = await chrome.runtime.sendMessage({ action: 'groupTabs' });
            if (response.success) {
                setTimeout(async () => {
                    await updateStats();
                    hideLoading();
                }, 1000);
            } else {
                console.error('Error grouping tabs:', response.error);
                hideLoading();
            }
        } catch (error) {
            console.error('Error:', error);
            hideLoading();
        }
    }
    
    // Ungroup tabs
    async function ungroupTabs() {
        showLoading();
        try {
            const response = await chrome.runtime.sendMessage({ action: 'ungroupTabs' });
            if (response.success) {
                setTimeout(async () => {
                    await updateStats();
                    hideLoading();
                }, 1000);
            } else {
                console.error('Error ungrouping tabs:', response.error);
                hideLoading();
            }
        } catch (error) {
            console.error('Error:', error);
            hideLoading();
        }
    }
    
    // Event Listeners
    groupBtn.addEventListener('click', groupTabs);
    ungroupBtn.addEventListener('click', ungroupTabs);
    
    // Always update stats when user open popup
    await updateStats();
    
    // Update stats every 2 sec
    setInterval(updateStats, 2000);
});


document.getElementById('save-threshold').addEventListener('click', async () => {
    const hours = parseInt(document.getElementById('hours').value) || 0;
    const days = parseInt(document.getElementById('days').value) || 0;
    const weeks = parseInt(document.getElementById('weeks').value) || 0;

    const ms = 
        hours * 60 * 60 * 1000 + 
        days * 24 * 60 * 60 * 1000 + 
        weeks * 7 * 24 * 60 * 60 * 1000;

    chrome.runtime.sendMessage({
        action: 'setTimeThreshold',
        milliseconds: ms
    }, (response) => {
        if (response?.success) {
            alert('Saved time settings!');
        }
    });
});