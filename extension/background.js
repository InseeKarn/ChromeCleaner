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
    'twitter.com': 'Twitter',
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

// Grouptabs
async function groupTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const domainGroups = new Map();
    
    // sorted from domain
    for (const tab of tabs) {
      const domain = getDomainFromUrl(tab.url);
      if (domain && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, []);
        }
        domainGroups.get(domain).push(tab);
      }
    }
    
    // Created group for > 1 domain
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
    console.error('Error in groupTabs:', error);
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


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setAutoClean') {
        autoCleanEnabled = !!request.enabled;
        chrome.storage.sync.set({ autoCleanEnabled });
        sendResponse({ success: true });
        return true;
    }

    // Adjust time
    if (request.action === 'setTimeThreshold') {
        timeThreshold = request.milliseconds;
        chrome.storage.sync.set({ timeThreshold: timeThreshold });
        console.log('timeThreshold updated to', timeThreshold, 'ms');
        sendResponse({ success: true });
        return true;
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
  // Wait for url load
  setTimeout(async () => {
    const domain = getDomainFromUrl(tab.url);
    if (domain) {
      // Check ig that have tabs in same domain?
      const sameDomainTabs = await chrome.tabs.query({});
      const matchingTabs = sameDomainTabs.filter(t => 
        t.id !== tab.id && getDomainFromUrl(t.url) === domain
      );
      
      if (matchingTabs.length > 0) {
        // Find this domain have group exitst?
        const existingGroup = matchingTabs.find(t => t.groupId !== -1);
        if (existingGroup) {
          // Add tabs
          await chrome.tabs.group({ 
            groupId: existingGroup.groupId, 
            tabIds: [tab.id] 
          });
        } else {
          await groupTabs();
        }
      }
    }
  }, 1000);

  tabOpenTimes[tab.id] = Date.now();
});


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const domain = getDomainFromUrl(tab.url);
    if (domain) {
      // Check if should created new grou?
      setTimeout(() => groupTabs(), 500);
    }
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

// Litsen popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabStats') {
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
    return true;
  }


  if (request.action === 'groupTabs') {
    groupTabs().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'ungroupTabs') {
    ungroupTabs().then(() => sendResponse({ success: true }));
    return true;
  }

  sendResponse({ success: false, error: 'Unknown action' });
});


chrome.runtime.onInstalled.addListener(() => {
  console.log('ChromeCleaner installed');
  setTimeout(() => groupTabs(), 1000);
});

// Group when start
chrome.runtime.onStartup.addListener(() => {
  setTimeout(() => groupTabs(), 2000);
});
