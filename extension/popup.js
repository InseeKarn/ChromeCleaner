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

    // Progress bar
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
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
    
    // ============== Progress bar ==============

    async function fetchDonationTotal() {
    try {
        const res = await fetch('https://script.google.com/macros/s/AKfycbw3InaLalRNRK33BKWvtro6JO_ihoFwfCMocwEkaU_TtVNu_S-AQVf9ZBlj6f7obN8/exec');
        const data = await res.json();
        return data.total || 0;
        } catch (err) {
            console.error('Failed to fetch donation total:', err);
            return 0;
        }
    }

    async function updateProgressBar() {
        const total = await fetchDonationTotal();
        const goal = 1000;
        const percentage = Math.min((total / goal) * 100, 100);
        progressBar.style.width = percentage + '%';
        progressText.textContent = `$${total} / $${goal}`;
    }

    updateProgressBar();

    // ============== Progress bar ==============


    // Save threshold button
    const saveBtn = document.getElementById('save-threshold');
    saveBtn.addEventListener('click', async () => {
    const hours = parseInt(document.getElementById('hours').value) || 0;
    const days = parseInt(document.getElementById('days').value) || 0;
    const weeks = parseInt(document.getElementById('weeks').value) || 0;

    const ms =
        hours * 3600000 +
        days * 86400000 +
        weeks * 604800000;

    chrome.runtime.sendMessage({ action: 'setTimeThreshold', milliseconds: ms }, (response) => {
        if (response?.success) alert('Saved time settings!');
    });
    });

    // Donate button
    const donateButtons = document.querySelectorAll('.btn-donate');
    donateButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseInt(btn.dataset.amount);
            const isLocal = window.location.hostname.includes('localhost');
            // const isLocal = true;

            console.log('Sending donate message:', { amount, isLocal });
            chrome.runtime.sendMessage(
                { action: 'donate', amount, isLocal },
                (response) => {
                    if (response.success && response.url) {
                        chrome.tabs.create({ url: response.url });
                    } else {
                        console.error('Donate failed:', response.error);
                    }
                }
            );
        });
    });


    
    // Custom amount
    const donateCustomBtn = document.getElementById('donateCustomBtn');
    donateCustomBtn.addEventListener('click', () => {
        const input = document.getElementById('customAmount');
        let amount = parseFloat(input.value);

        if (!amount || amount < 1) {
            alert('Please enter a valid amount (min $1)');
            return;
        }

        const isLocal = window.location.hostname.includes('localhost');
        console.log('Sending custom donate message:', { amount, isLocal });
        chrome.runtime.sendMessage(
            { action: 'donate', amount, isLocal },
            (response) => {
                if (response.success && response.url) {
                    chrome.tabs.create({ url: response.url });
                } else {
                    console.error('Donate failed:', response.error);
                }
            }
        );
    });
    
    await updateStats();
    setInterval(updateStats, 2000);


});
