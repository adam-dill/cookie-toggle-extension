const toggleButton = document.getElementById('toggleButton');
const toggleStatusEl = document.getElementById('toggleStatus');
const configListEl = document.getElementById('configList');
const addCookieButton = document.getElementById('addCookieButton');
const saveConfigButton = document.getElementById('saveConfigButton');
const manageDetails = document.getElementById('manageDetails');
const messageEl = document.getElementById('message');

const STORAGE_KEY_CONFIGS = 'cookieToggle_cookieConfigs';
let currentTabUrl = null;
let configs = [];
let savedConfigs = [];
let messageTimeoutId = null;

function setMessage(text, isError = false) {
  clearTimeout(messageTimeoutId);
  messageEl.textContent = text;
  messageEl.style.color = isError ? '#b91c1c' : '#1f2937';
  messageEl.style.opacity = '1';
  messageEl.style.visibility = 'visible';

  messageTimeoutId = window.setTimeout(() => {
    messageEl.style.opacity = '0';
    messageEl.style.visibility = 'hidden';
  }, 3000);
}

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function setStorage(items) {
  return new Promise(resolve => chrome.storage.local.set(items, resolve));
}

function updateSaveButtonState() {
  const hasChanges = JSON.stringify(configs) !== JSON.stringify(savedConfigs);
  saveConfigButton.disabled = !hasChanges;
}

function markConfigsDirty() {
  updateSaveButtonState();
}

function markConfigsSaved() {
  savedConfigs = JSON.parse(JSON.stringify(configs));
  updateSaveButtonState();
}

async function queryCurrentTabUrl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) {
    throw new Error('Unable to detect active tab.');
  }
  return tabs[0].url;
}

function createCookieConfigRow(config = {}, index = 0) {
  const row = document.createElement('div');
  row.className = 'cookie-config-row';
  row.dataset.index = index;

  row.innerHTML = `
    <div class="cookie-config-grid">
      <div>
        <label class="small-label">Cookie Name</label>
        <input type="text" name="name" value="${config.name || ''}" placeholder="cookie_name" />
      </div>
      <div>
        <label class="small-label">Enabled Value</label>
        <input type="text" name="enabled" value="${config.enabled || ''}" placeholder="enabled value" />
      </div>
    </div>
    <div class="cookie-config-grid">
      <div class="disabled-value-group" ${config.deleteOnDisable ? 'hidden' : ''}>
        <label class="small-label">Disabled Value</label>
        <input type="text" name="disabled" value="${config.disabled || ''}" placeholder="disabled value" />
      </div>
      <div class="checkbox-row">
        <input id="delete_${index}" type="checkbox" name="deleteOnDisable" ${config.deleteOnDisable ? 'checked' : ''} />
        <label for="delete_${index}">Delete on Disable</label>
      </div>
    </div>
    <div class="row-actions">
      <button type="button" class="danger removeButton">Remove</button>
    </div>
  `;

  const disableValueGroup = row.querySelector('.disabled-value-group');
  const disabledValueInput = row.querySelector('input[name="disabled"]');
  const deleteOnDisableInput = row.querySelector('input[name="deleteOnDisable"]');

  const inputs = row.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      const rowIndex = Number(row.dataset.index);
      const currentConfig = configs[rowIndex] || { name: '', enabled: '', disabled: '', deleteOnDisable: false };
      if (input.name === 'name') currentConfig.name = input.value.trim();
      if (input.name === 'enabled') currentConfig.enabled = input.value;
      if (input.name === 'disabled') currentConfig.disabled = input.value;
      if (input.name === 'deleteOnDisable') currentConfig.deleteOnDisable = input.checked;
      configs[rowIndex] = currentConfig;
      markConfigsDirty();
    });
    input.addEventListener('change', () => {
      const rowIndex = Number(row.dataset.index);
      const currentConfig = configs[rowIndex] || { name: '', enabled: '', disabled: '', deleteOnDisable: false };
      if (input.name === 'name') currentConfig.name = input.value.trim();
      if (input.name === 'enabled') currentConfig.enabled = input.value;
      if (input.name === 'disabled') currentConfig.disabled = input.value;
      if (input.name === 'deleteOnDisable') currentConfig.deleteOnDisable = input.checked;
      configs[rowIndex] = currentConfig;
      markConfigsDirty();
    });
  });

  deleteOnDisableInput.addEventListener('change', () => {
    const rowIndex = Number(row.dataset.index);
    const currentConfig = configs[rowIndex] || { name: '', enabled: '', disabled: '', deleteOnDisable: false };

    if (deleteOnDisableInput.checked) {
      row.dataset.disabledValueBackup = currentConfig.disabled || '';
      currentConfig.disabled = '';
      currentConfig.deleteOnDisable = true;
      if (disabledValueInput) {
        disabledValueInput.value = '';
      }
      if (disableValueGroup) {
        disableValueGroup.hidden = true;
      }
    } else {
      const restoredValue = row.dataset.disabledValueBackup || currentConfig.disabled || '';
      currentConfig.disabled = restoredValue;
      currentConfig.deleteOnDisable = false;
      if (disabledValueInput) {
        disabledValueInput.value = restoredValue;
      }
      if (disableValueGroup) {
        disableValueGroup.hidden = false;
      }
    }

    configs[rowIndex] = currentConfig;
    markConfigsDirty();
  });

  row.querySelector('.removeButton').addEventListener('click', () => {
    const idx = Number(row.dataset.index);
    configs.splice(idx, 1);
    markConfigsDirty();
    renderConfigRows();
  });

  return row;
}

function renderConfigRows() {
  configListEl.innerHTML = '';

  if (!configs.length) {
    const empty = document.createElement('div');
    empty.className = 'cookie-config-row';
    empty.textContent = 'No cookie configurations yet. Add one to start toggling.';
    configListEl.appendChild(empty);
    return;
  }

  configs.forEach((config, index) => {
    configListEl.appendChild(createCookieConfigRow(config, index));
  });
}

async function saveConfigs({ rerender = true } = {}) {
  const data = { [STORAGE_KEY_CONFIGS]: configs };
  await setStorage(data);
  if (rerender) {
    renderConfigRows();
  }
  markConfigsSaved();
}

async function loadConfigs() {
  const stored = await getStorage(STORAGE_KEY_CONFIGS);
  configs = stored[STORAGE_KEY_CONFIGS] || [];
  savedConfigs = JSON.parse(JSON.stringify(configs));
  renderConfigRows();
  updateSaveButtonState();
}

function isSecureUrl() {
  return new URL(currentTabUrl).protocol === 'https:';
}

async function setCookieValue(name, value) {
  const date = new Date();
  // Add 400 days (max allowed) to the current date 
  date.setDate(date.getDate() + 400);
  // Convert to UNIX epoch in seconds
  const expirationInSeconds = Math.floor(date.getTime() / 1000);

  await chrome.cookies.set({
    url: currentTabUrl,
    name,
    value,
    path: '/',
    secure: isSecureUrl(),
    sameSite: 'lax',
    expirationDate: expirationInSeconds
  });
}

async function deleteCookie(name) {
  await chrome.cookies.remove({ url: currentTabUrl, name });
}

async function checkCookieStatus(config) {
  if (!config.name) {
    return { status: 'missing' };
  }

  const cookie = await chrome.cookies.get({ name: config.name, url: currentTabUrl });
  if (!cookie) {
    return { status: 'missing' };
  }

  if (config.enabled && cookie.value === config.enabled) {
    return { status: 'enabled' };
  }
  if (config.disabled && cookie.value === config.disabled) {
    return { status: 'disabled' };
  }
  return { status: 'custom' };
}

function setActionState(isActive, label) {
  toggleButton.classList.toggle('active', isActive);
  toggleStatusEl.textContent = label;
  const iconPath = isActive ? {
    '16': 'icon-green.png',
    '48': 'icon-green.png',
    '128': 'icon-green.png'
  } : {
    '16': 'icon-gray.png',
    '48': 'icon-gray.png',
    '128': 'icon-gray.png'
  };

  chrome.action.setIcon({ path: iconPath });
  chrome.action.setBadgeText({ text: isActive ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: isActive ? '#16a34a' : '#6b7280' });
}

async function refreshState() {
  if (!currentTabUrl) {
    setActionState(false, 'Open a site first');
    return;
  }

  if (!configs.length) {
    setActionState(false, 'No cookies configured');
    return;
  }

  const statuses = await Promise.all(configs.map(config => checkCookieStatus(config)));
  const allEnabled = statuses.every(status => status.status === 'enabled');
  const label = allEnabled ? 'Enabled' : 'Disabled';
  setActionState(allEnabled, label);
  setMessage('Ready');
}

async function toggleCookies() {
  if (!configs.length) {
    setMessage('Add cookies in Manage before toggling.', true);
    return;
  }

  const statuses = await Promise.all(configs.map(config => checkCookieStatus(config)));
  const allEnabled = statuses.every(status => status.status === 'enabled');

  for (const config of configs) {
    if (!config.name) continue;
    if (allEnabled) {
      if (config.deleteOnDisable) {
        await deleteCookie(config.name);
      } else {
        await setCookieValue(config.name, config.disabled || '');
      }
    } else {
      await setCookieValue(config.name, config.enabled || '');
    }
  }

  await refreshState();
  setMessage(allEnabled ? 'Disabled configured cookies.' : 'Enabled configured cookies.');
}

function wireEvents() {
  toggleButton.addEventListener('click', async () => {
    try {
      await toggleCookies();
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  addCookieButton.addEventListener('click', () => {
    configs.push({ name: '', enabled: '', disabled: '', deleteOnDisable: false });
    markConfigsDirty();
    renderConfigRows();
  });

  saveConfigButton.addEventListener('click', async () => {
    try {
      await saveConfigs({ rerender: true });
      await refreshState();
      manageDetails.open = false;
      setMessage('Configurations saved.');
    } catch (error) {
      setMessage(error.message, true);
    }
  });
}

async function init() {
  try {
    currentTabUrl = await queryCurrentTabUrl();
    await loadConfigs();
    wireEvents();
    updateSaveButtonState();
    await refreshState();
  } catch (error) {
    setActionState(false, 'Unable to read site');
    setMessage(error.message, true);
  }
}

init();
