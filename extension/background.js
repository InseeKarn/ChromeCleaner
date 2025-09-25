// ChromeCleaner - background.js
let tabGroups = new Map();

// Pull domain from URL
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Get group name
function getGroupName(domain) {
  const domainMap = {
    'youtube.com': 'YouTube',
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'github.com': 'GitHub',
    'google.com': 'Google',
    'gmail.com': 'Gmail',
    'netflix.com': 'Netflix',
    'amazon.com': 'Amazon',
    'linkedin.com': 'LinkedIn'
  };
  
  return domainMap[domain] || domain.charAt(0).toUpperCase() + domain.slice(1).split('.')[0];
}

// Colors
function getGroupColor(domain) {
  const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

let autoGroupEnabled = true;

chrome.storage.sync.get(['autoGroupEnabled'], (result) => {
    if (result.autoGroupEnabled === undefined) {
        autoGroupEnabled = true;
        chrome.storage.sync.set({ autoGroupEnabled: true });
    } else {
        autoGroupEnabled = result.autoGroupEnabled;
    }
});


async function groupNewDomainTabs(newTab) {
  if (!autoGroupEnabled) return;

  const domain = getDomainFromUrl(newTab.url);
  if (!domain) return;

  const allTabs = await chrome.tabs.query({});
  const matchingTabs = allTabs.filter(t => t.id !== newTab.id && getDomainFromUrl(t.url) === domain);

  if (matchingTabs.length > 0) {
    const existingGroup = matchingTabs.find(t => t.groupId !== -1);
    if (existingGroup) {
      await chrome.tabs.group({ groupId: existingGroup.groupId, tabIds: [newTab.id] });
    } else {
      await groupSpecificDomainTabs([newTab, ...matchingTabs]);
    }
  }
}


async function groupSpecificDomainTabs(tabsToGroup) {
  if (tabsToGroup.length <= 1) return;

  try {
    const domain = getDomainFromUrl(tabsToGroup[0].url);
    if (!domain) return;

    const tabIds = tabsToGroup.map(tab => tab.id);
    const groupName = getGroupName(domain);
    const groupColor = getGroupColor(domain);

    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: groupName,
      color: groupColor,
      collapsed: true
    });

    tabGroups.set(groupId, {
      domain,
      name: groupName,
      color: groupColor,
      collapsed: true
    });

  } catch (error) {
    console.error('Error creating group for domain:', error);
  }
}


async function groupAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const domainGroups = new Map();


    for (const tab of tabs) {
      const domain = getDomainFromUrl(tab.url);
      if (domain && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, []);
        }
        domainGroups.get(domain).push(tab);
      }
    }


    for (const [domain, tabsInDomain] of domainGroups) {
      if (tabsInDomain.length > 1) {
        const tabIds = tabsInDomain.map(tab => tab.id);
        const groupName = getGroupName(domain);
        const groupColor = getGroupColor(domain);

        try {
          const firstTab = tabsInDomain[0];
          if (firstTab.groupId === -1) {
            const groupId = await chrome.tabs.group({ tabIds });
            await chrome.tabGroups.update(groupId, {
              title: groupName,
              color: groupColor,
              collapsed: true
            });

            tabGroups.set(groupId, {
              domain,
              name: groupName,
              color: groupColor,
              collapsed: true
            });
          }
        } catch (error) {
          console.error('Error creating group for', domain, ':', error);
        }
      }
    }

  } catch (error) {
    console.error('Error in groupAllTabs:', error);
  }
}

// Ungroup
async function ungroupTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const groupedTabs = tabs.filter(tab => tab.groupId !== -1);
    
    for (const tab of groupedTabs) {
      await chrome.tabs.ungroup(tab.id);
    }
    
    tabGroups.clear();
  } catch (error) {
    console.error('Error in ungroupTabs:', error);
  }
}


let tabOpenTimes = {};
// 1 hours
let timeThreshold = 1 * 60 * 60 * 1000;
// let timeThreshold = 5 * 1000;
let autoCleanEnabled = false;

async function filterOldTabs() {
    if (!autoCleanEnabled) return;

    const tabs = await chrome.tabs.query({});
    const oldTabs = [];

    for (const tab of tabs) {
        if (tab.url.startsWith('chrome://') ||
            tab.url.startsWith('chrome-extension://') ||
            tab.pinned ||
            tab.active) continue;

        tabOpenTimes[tab.id] = tabOpenTimes[tab.id] || Date.now() - (timeThreshold + 5000);

        if (Date.now() - tabOpenTimes[tab.id] > timeThreshold) {
            oldTabs.push(tab.id);
        }
    }

    if (oldTabs.length) console.log('Removing tabs:', oldTabs);

    for (const tabId of oldTabs) {
        await chrome.tabs.remove(tabId);
    }

    return oldTabs;
}


setInterval(filterOldTabs, 5000);


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
        case 'groupTabsManual':
        case 'groupTabsInitial':
            groupAllTabs()
                .then(() => sendResponse({ success: true }))
                .catch(err => {
                    console.error(err);
                    sendResponse({ success: false, error: err.message });
                });
            return true;
        case 'ungroupTabs':
            ungroupTabs().then(() => sendResponse({ success: true }));
            return true;
        case 'setAutoGroup':
            autoGroupEnabled = !!msg.enabled;
            chrome.storage.sync.set({ autoGroupEnabled });
            sendResponse({ success: true });
            break;
        case 'setAutoClean':
            autoCleanEnabled = !!msg.enabled;
            chrome.storage.sync.set({ autoCleanEnabled });
            sendResponse({ success: true });
            break;

        case 'setTimeThreshold':
            timeThreshold = msg.milliseconds;
            chrome.storage.sync.set({ timeThreshold });
            console.log('timeThreshold updated to', timeThreshold, 'ms');
            sendResponse({ success: true });
            break;

        case 'getTabStats':
            chrome.tabs.query({}, (tabs) => {
                chrome.tabGroups.query({}, (groups) => {
                    const groupedTabs = tabs.filter(tab => tab.groupId !== -1).length;
                    sendResponse({
                        success: true,
                        data: {
                            totalTabs: tabs.length,
                            totalGroups: groups.length,
                            groupedTabs: groupedTabs,
                            ungroupedTabs: tabs.length - groupedTabs
                        }
                    });
                });
            });
            return true; // async

        case 'groupTabs':
            groupAllTabs()
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;

        case 'donate':
            if (typeof msg.amount !== 'number') {
                sendResponse({ success: false, error: 'Invalid amount' });
                break;
            }

            const baseURL = msg.isLocal 
                ? 'http://localhost:8888/.netlify/functions'
                : 'https://chromecleaner.netlify.app/.netlify/functions';

            fetch(`${baseURL}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: msg.amount })
            })
            .then(res => res.json())
            .then(data => {
                console.log('Checkout response:', data);
                if (data.url) {
                    sendResponse({ success: true, url: data.url });
                } else {
                    sendResponse({ success: false, error: 'No URL returned' });
                }
            })
            .catch(err => sendResponse({ success: false, error: err.message }));

            return true;

        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});


chrome.storage.sync.get(['timeThreshold'], (data) => {
  if (data.timeThreshold) {
    timeThreshold = data.timeThreshold;
  }
});

// save new threshold
function setTimeThreshold(hours = 1, days = 0, weeks = 0) {
  const ms = 
    hours * 60 * 60 * 1000 + 
    days * 24 * 60 * 60 * 1000 + 
    weeks * 7 * 24 * 60 * 60 * 1000;
  timeThreshold = ms;
  chrome.storage.sync.set({ timeThreshold: ms });
}


// Event Listeners
chrome.tabs.onCreated.addListener(async (tab) => {
    tabOpenTimes[tab.id] = Date.now();

    if (!autoGroupEnabled) return;

    setTimeout(() => groupNewDomainTabs(tab), 1000);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && autoGroupEnabled) {
        setTimeout(() => groupNewDomainTabs(tab), 500);
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Check tabs <= 1
  setTimeout(async () => {
    try {
      const groups = await chrome.tabGroups.query({});
      for (const group of groups) {
        const tabsInGroup = await chrome.tabs.query({ groupId: group.id });
        if (tabsInGroup.length <= 1) {
          // Cancle gruop when it's <= 1 tab
          if (tabsInGroup.length === 1) {
            await chrome.tabs.ungroup(tabsInGroup[0].id);
          }
          tabGroups.delete(group.id);
        }
      }
    } catch (error) {
      console.error('Error cleaning up groups:', error);
    }
  }, 500);
});


chrome.tabGroups.onUpdated.addListener(async (group) => {
  if (tabGroups.has(group.id)) {
    tabGroups.get(group.id).collapsed = group.collapsed;
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {

    console.log('Context menu clicked', info, tab);

    if (info.menuItemId === "groupDomainTabs") {
        const domain = getDomainFromUrl(tab.url);
        if (!domain) return;

        const allTabs = await chrome.tabs.query({});
        const matchingTabs = allTabs.filter(t => getDomainFromUrl(t.url) === domain);

        console.log('Tabs to group:', matchingTabs);

        // group tabs
        await groupSpecificDomainTabs(matchingTabs);
    }
});


chrome.runtime.onInstalled.addListener(async () => {
  console.log('ChromeCleaner installed');

  chrome.contextMenus.create({
    id: "groupDomainTabs",
    title: "Group tabs by this domain",
    contexts: ["tab"]
  });
  
  console.log('Context menu created');

  const result = await chrome.storage.sync.get(['autoGroupEnabled']);
  if (result.autoGroupEnabled !== undefined) {
    autoGroupEnabled = result.autoGroupEnabled;
  } else {

    autoGroupEnabled = true;
    chrome.storage.sync.set({ autoGroupEnabled: true });
  }


  if (autoGroupEnabled) {
    setTimeout(() => groupAllTabs(), 1000);
  }
});

// Group when start
chrome.runtime.onStartup.addListener(async () => {

  const result = await chrome.storage.sync.get(['autoGroupEnabled']);
  if (result.autoGroupEnabled !== undefined) {
    autoGroupEnabled = result.autoGroupEnabled;
  }

  if (autoGroupEnabled) {
    setTimeout(() => groupAllTabs(), 2000);
  }
});

