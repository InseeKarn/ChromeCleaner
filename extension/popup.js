// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const groupBtn = document.getElementById('groupBtn');
    const ungroupBtn = document.getElementById('ungroupBtn');
    const loading = document.getElementById('loading');
    const filter_toggle = document.getElementById('enable-filter');
    const group_toggle = document.getElementById('enable-autogroup');
    let autoGroupEnabled = group_toggle.checked;

    const filter_result = await chrome.storage.sync.get(['autoCleanEnabled']);
    filter_toggle.checked = filter_result.autoCleanEnabled || false;

    const group_result = await chrome.storage.sync.get(['autoGroupEnabled']);
    if (group_result.autoGroupEnabled === undefined) {
        group_toggle.checked = true;
        chrome.storage.sync.set({ autoGroupEnabled: true });
    } else {
        group_toggle.checked = group_result.autoGroupEnabled;
    }
    
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

    // Toggle auto group
    group_toggle.addEventListener('change', async () => {
        const enabled = group_toggle.checked;

        chrome.runtime.sendMessage({ action: 'setAutoGroup', enabled });

        if (enabled) {
            await chrome.runtime.sendMessage({ action: 'groupTabsInitial' });
        }
    });

    // Toggle auto clean
    filter_toggle.addEventListener('change', () => {
        chrome.runtime.sendMessage({
            action: 'setAutoClean',
            enabled: filter_toggle.checked
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

    function sendMessagePromise(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                resolve(response);
            });
        });
    }
    
    // Group tabs (manual)
    async function groupTabs() {
        showLoading();
        try {
            const response = await sendMessagePromise({ action: 'groupTabsManual' });
            if (response.success) {
                await updateStats();
            } else {
                console.error('Error grouping tabs:', response.error);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
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
            const res = await fetch('https://script.google.com/macros/s/AKfycbyxjRwmCxnyCNQVZhUyEtnWs-dkaKLS-29JoxZJZpILG9EWecQsqTBqMBN1ZDUHPxY/exec');
            const data = await res.json();
            return data.total || 0;
            } catch (err) {
                console.error('Failed to fetch donation total:', err);
                return 0;
            }
    }

    let animating = false;
    async function updateProgressBar() {
        if (animating) return;
        animating = true;

        const total = await fetchDonationTotal();
        const goal = 100000;
        const percentage = Math.min((total / goal) * 100, 100);

        console.log("DEBUG total =", total, "goal =", goal);


        const duration = 2000;
        const startTime = performance.now();
        const startTotal = parseInt(progressText.textContent.replace(/\D/g, '')) || 0;

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentTotal = Math.floor(startTotal + progress * (total - startTotal));
            const currentPercentage = Math.min((currentTotal / goal) * 100, 100);

            progressBar.style.width = currentPercentage + '%';
            progressText.textContent = `$${currentTotal} / $${goal}`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

    requestAnimationFrame(animate);

    }

    setInterval(updateProgressBar, 2000);

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
