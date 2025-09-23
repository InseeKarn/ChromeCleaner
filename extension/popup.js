chrome.tabs.query({}, (tabs) => {
  const domainGroups = {};

  tabs.forEach(tab => {
    const url = new URL(tab.url);
    const domain = url.hostname;

    if (!domainGroups[domain]) domainGroups[domain] = [];
    domainGroups[domain].push(tab.id);
  });

  // สร้าง Tab Group สำหรับแต่ละ domain
  for (const domain in domainGroups) {
    chrome.tabs.group({ tabIds: domainGroups[domain] }, (groupId) => {
      chrome.tabGroups.update(groupId, { title: domain, color: "blue" });
    });
  }
});
