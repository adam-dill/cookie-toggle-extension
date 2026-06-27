const STORAGE_KEY_CONFIGS = 'cookieToggle_cookieConfigs';

const ICONS = {
  active: 'icon-green.png',
  inactive: 'icon-gray.png'
};

function getIconPath(fileName) {
  return chrome.runtime.getURL(fileName);
}

function setIconState(isActive, badgeText = '') {
  const iconFile = isActive ? ICONS.active : ICONS.inactive;
  chrome.action.setIcon({
    path: {
      '16': getIconPath(iconFile),
      '48': getIconPath(iconFile),
      '128': getIconPath(iconFile)
    }
  });
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: isActive ? '#16a34a' : '#6b7280' });
}

async function updateIconForTab(tab) {
  if (!tab?.url || !tab.url.startsWith('http')) {
    setIconState(false, '');
    return;
  }

  const result = await chrome.storage.local.get(STORAGE_KEY_CONFIGS);
  const configs = result[STORAGE_KEY_CONFIGS] || [];
  const validConfigs = configs.filter(config => config?.name);

  if (!validConfigs.length) {
    setIconState(false, '');
    return;
  }

  try {
    const statuses = await Promise.all(validConfigs.map(async config => {
      const cookie = await chrome.cookies.get({ name: config.name, url: tab.url });
      if (!cookie) return 'missing';
      if (config.enabled && cookie.value === config.enabled) return 'enabled';
      return 'disabled';
    }));

    const allEnabled = statuses.length > 0 && statuses.every(status => status === 'enabled');
    setIconState(allEnabled, allEnabled ? 'ON' : 'OFF');
  } catch (error) {
    setIconState(false, '');
  }
}

async function refreshActiveTabState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await updateIconForTab(tab);
}

chrome.runtime.onStartup.addListener(refreshActiveTabState);
chrome.runtime.onInstalled.addListener(refreshActiveTabState);
chrome.tabs.onActivated.addListener(() => refreshActiveTabState());
chrome.tabs.onUpdated.addListener(() => refreshActiveTabState());
chrome.windows.onFocusChanged.addListener(() => refreshActiveTabState());
chrome.storage.onChanged.addListener(() => refreshActiveTabState());

refreshActiveTabState();
