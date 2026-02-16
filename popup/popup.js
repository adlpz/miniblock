// Miniblock - Popup Script
// Handles popup UI interactions

/**
 * Check if a host matches any blocked site entry using smart subdomain matching.
 * Returns the matching entry object, or null if not blocked.
 * @param {string} host - The host to check
 * @param {Array<{host: string, mode: string}>} siteEntries - Array of blocked site entries
 * @returns {{host: string, mode: string}|null} The matching entry or null
 */
function getMatchingBlockedHost(host, siteEntries) {
  if (!host || !siteEntries || siteEntries.length === 0) {
    return null;
  }

  const normalizedHost = host.toLowerCase().trim();

  for (const entry of siteEntries) {
    const normalizedBlocked = entry.host.toLowerCase().trim();

    // Exact match
    if (normalizedHost === normalizedBlocked) {
      return entry;
    }

    // Subdomain match: if blocked host is "twitter.com",
    // then "mobile.twitter.com" should be blocked
    if (normalizedHost.endsWith('.' + normalizedBlocked)) {
      return entry;
    }
  }

  return null;
}

/**
 * Determine if a host is a subdomain (has more than one dot after removing TLD)
 * Simple heuristic: if host has more than one dot, it's likely a subdomain
 * @param {string} host - The hostname to check
 * @returns {boolean} True if appears to be a subdomain
 */
function isSubdomain(host) {
  // Count dots in the host
  const dotCount = (host.match(/\./g) || []).length;
  // If more than one dot, it's a subdomain (e.g., mail.google.com has 2 dots)
  // Single dot = root domain (e.g., google.com has 1 dot)
  return dotCount > 1;
}

/**
 * Get the root domain from a hostname
 * @param {string} host - The hostname
 * @returns {string} The root domain (last two parts)
 */
function getRootDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) {
    return host;
  }
  return parts.slice(-2).join('.');
}

/**
 * Validate and normalize a hostname input
 * @param {string} input - User input for hostname
 * @returns {{valid: boolean, host: string, error: string}} Validation result
 */
function validateHostInput(input) {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, host: '', error: 'Please enter a site' };
  }

  // Remove protocol if user included it
  let host = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]; // Remove any path

  // Basic hostname validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host)) {
    return { valid: false, host: '', error: 'Invalid hostname format' };
  }

  // Must have at least one dot (e.g., example.com)
  if (!host.includes('.')) {
    return { valid: false, host: '', error: 'Enter a full domain (e.g., example.com)' };
  }

  return { valid: true, host, error: '' };
}

/**
 * Get display label for a mode
 * @param {string} mode
 * @returns {string}
 */
function getModeLabel(mode) {
  return mode === 'scheduled' ? 'work hours' : 'always';
}

/**
 * Render the blocklist in the popup
 * @param {Array<{host: string, mode: string}>} sites - Array of blocked site entries
 */
function renderBlocklist(sites) {
  const blocklistEl = document.getElementById('blocklist');
  blocklistEl.innerHTML = '';

  // Sort sites alphabetically by host
  const sortedSites = [...sites].sort((a, b) => a.host.localeCompare(b.host));

  for (const entry of sortedSites) {
    const li = document.createElement('li');
    li.className = 'blocklist-item';

    const hostSpan = document.createElement('span');
    hostSpan.className = 'blocklist-item-host';
    hostSpan.textContent = entry.host;

    const controls = document.createElement('span');
    controls.className = 'blocklist-item-controls';

    const modeBadge = document.createElement('button');
    modeBadge.className = `mode-badge mode-${entry.mode}`;
    modeBadge.textContent = getModeLabel(entry.mode);
    modeBadge.type = 'button';
    modeBadge.title = `Click to switch to ${entry.mode === 'always' ? 'work hours' : 'always'}`;
    modeBadge.addEventListener('click', async () => {
      const newMode = entry.mode === 'always' ? 'scheduled' : 'always';
      modeBadge.disabled = true;
      const success = await updateSiteMode(entry.host, newMode);
      if (success) {
        const updatedSites = await getSites();
        renderBlocklist(updatedSites);
      } else {
        modeBadge.disabled = false;
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', async () => {
      removeBtn.disabled = true;
      removeBtn.textContent = '...';
      const success = await removeSite(entry.host);
      if (success) {
        // Refresh the list
        const updatedSites = await getSites();
        renderBlocklist(updatedSites);
        // Also refresh current site status
        await refreshCurrentSiteStatus();
      } else {
        removeBtn.disabled = false;
        removeBtn.textContent = 'Error';
      }
    });

    controls.appendChild(modeBadge);
    controls.appendChild(removeBtn);
    li.appendChild(hostSpan);
    li.appendChild(controls);
    blocklistEl.appendChild(li);
  }
}

/**
 * Render the schedule windows UI
 * @param {{windows: Array<{start: string, end: string}>}} schedule
 */
function renderSchedule(schedule) {
  const listEl = document.getElementById('schedule-list');
  const emptyEl = document.getElementById('schedule-empty');
  listEl.innerHTML = '';

  if (schedule.windows.length === 0) {
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
  }

  // Sort windows by start time
  const sorted = [...schedule.windows].sort((a, b) => a.start.localeCompare(b.start));

  for (const w of sorted) {
    const li = document.createElement('li');
    li.className = 'schedule-item';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'schedule-item-time';
    timeSpan.textContent = `${w.start} – ${w.end}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', async () => {
      removeBtn.disabled = true;
      removeBtn.textContent = '...';
      const updated = { windows: schedule.windows.filter(x => x.start !== w.start || x.end !== w.end) };
      const success = await setSchedule(updated);
      if (success) {
        renderSchedule(updated);
      } else {
        removeBtn.disabled = false;
        removeBtn.textContent = 'Error';
      }
    });

    li.appendChild(timeSpan);
    li.appendChild(removeBtn);
    listEl.appendChild(li);
  }
}

// Store current host for refreshing status
let currentHost = null;
let currentTab = null;

/**
 * Refresh the current site's block status display
 */
async function refreshCurrentSiteStatus() {
  if (!currentHost || !currentTab) return;

  const blockStatusEl = document.getElementById('block-status');
  const blockBtn = document.getElementById('block-btn');

  const siteEntries = await getSites();
  const matchingEntry = getMatchingBlockedHost(currentHost, siteEntries);

  if (matchingEntry) {
    const modeText = matchingEntry.mode === 'scheduled' ? 'Blocked during work hours' : 'Currently blocked';
    const viaText = matchingEntry.host !== currentHost ? ` (via ${matchingEntry.host})` : '';
    blockStatusEl.textContent = `${modeText}${viaText}`;
    blockStatusEl.className = 'blocked';
    blockBtn.style.display = 'none';
  } else {
    blockStatusEl.textContent = '';
    blockStatusEl.className = '';
    blockBtn.style.display = 'block';
    blockBtn.disabled = false;
    blockBtn.textContent = `Block ${currentHost}`;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const currentHostEl = document.getElementById('current-host');
  const hostInfoEl = document.getElementById('host-info');
  const blockStatusEl = document.getElementById('block-status');
  const blockBtn = document.getElementById('block-btn');
  const addSiteInput = document.getElementById('add-site-input');
  const addSiteBtn = document.getElementById('add-site-btn');
  const addSiteError = document.getElementById('add-site-error');
  const addSiteModeSelect = document.getElementById('add-site-mode');

  // Load and render blocklist
  const siteEntries = await getSites();
  renderBlocklist(siteEntries);

  // Load and render schedule
  const schedule = await getSchedule();
  renderSchedule(schedule);

  // Set up schedule panel toggle
  const scheduleToggle = document.getElementById('schedule-toggle');
  const schedulePanel = document.getElementById('schedule-panel');
  scheduleToggle.addEventListener('click', () => {
    const expanded = schedulePanel.classList.toggle('visible');
    scheduleToggle.classList.toggle('expanded', expanded);
  });

  // Set up add window form
  const addWindowBtn = document.getElementById('add-window-btn');
  const windowStartInput = document.getElementById('window-start');
  const windowEndInput = document.getElementById('window-end');
  const scheduleError = document.getElementById('schedule-error');

  addWindowBtn.addEventListener('click', async () => {
    const start = windowStartInput.value;
    const end = windowEndInput.value;

    const validation = validateScheduleWindow(start, end);
    if (!validation.valid) {
      scheduleError.textContent = validation.error;
      return;
    }

    const currentSchedule = await getSchedule();
    const newWindow = { start, end };

    if (hasOverlap(currentSchedule.windows, newWindow)) {
      scheduleError.textContent = 'Overlaps with existing window';
      return;
    }

    scheduleError.textContent = '';
    addWindowBtn.disabled = true;
    addWindowBtn.textContent = '...';

    const updated = { windows: [...currentSchedule.windows, newWindow] };
    const success = await setSchedule(updated);

    if (success) {
      windowStartInput.value = '';
      windowEndInput.value = '';
      renderSchedule(updated);
    } else {
      scheduleError.textContent = 'Failed to save';
    }

    addWindowBtn.disabled = false;
    addWindowBtn.textContent = 'Add';
  });

  // Clear schedule error on input change
  windowStartInput.addEventListener('input', () => { scheduleError.textContent = ''; });
  windowEndInput.addEventListener('input', () => { scheduleError.textContent = ''; });

  // Set up add site form
  async function handleAddSite() {
    const validation = validateHostInput(addSiteInput.value);

    if (!validation.valid) {
      addSiteError.textContent = validation.error;
      return;
    }

    addSiteError.textContent = '';
    addSiteBtn.disabled = true;
    addSiteBtn.textContent = '...';

    const mode = addSiteModeSelect.value;
    const success = await addSite(validation.host, mode);

    if (success) {
      addSiteInput.value = '';
      // Refresh the blocklist
      const updatedSites = await getSites();
      renderBlocklist(updatedSites);
      // Refresh current site status in case we just blocked it
      await refreshCurrentSiteStatus();
    } else {
      addSiteError.textContent = 'Failed to add site';
    }

    addSiteBtn.disabled = false;
    addSiteBtn.textContent = 'Add';
  }

  addSiteBtn.addEventListener('click', handleAddSite);
  addSiteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAddSite();
    }
  });

  // Clear error when typing
  addSiteInput.addEventListener('input', () => {
    addSiteError.textContent = '';
  });

  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    currentHostEl.textContent = 'No site detected';
    return;
  }

  // Store for refreshing later
  currentTab = tab;

  // Parse the URL to get hostname
  let host;
  try {
    const url = new URL(tab.url);
    host = url.hostname.toLowerCase();
  } catch (e) {
    currentHostEl.textContent = 'Invalid URL';
    return;
  }

  // Store for refreshing later
  currentHost = host;

  // Skip chrome:// and extension pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    currentHostEl.textContent = host;
    hostInfoEl.textContent = 'Extension cannot block this page';
    return;
  }

  // Display current hostname
  currentHostEl.textContent = host;

  // Check if it's a subdomain and show info
  const subdomain = isSubdomain(host);
  const rootDomain = getRootDomain(host);
  if (subdomain) {
    hostInfoEl.textContent = `Subdomain of ${rootDomain}`;
  } else {
    hostInfoEl.textContent = 'Root domain';
  }

  // Check if this site (or its root domain) is already blocked
  const matchingEntry = getMatchingBlockedHost(host, siteEntries);

  if (matchingEntry) {
    // Site is blocked
    const modeText = matchingEntry.mode === 'scheduled' ? 'Blocked during work hours' : 'Currently blocked';
    const viaText = matchingEntry.host !== host ? ` (via ${matchingEntry.host})` : '';
    blockStatusEl.textContent = `${modeText}${viaText}`;
    blockStatusEl.className = 'blocked';
    blockBtn.style.display = 'none';
  } else {
    // Site is not blocked - show block button
    blockStatusEl.textContent = '';
    blockBtn.style.display = 'block';
    blockBtn.textContent = `Block ${host}`;

    // Handle block button click
    blockBtn.addEventListener('click', async () => {
      blockBtn.disabled = true;
      blockBtn.textContent = 'Blocking...';

      const success = await addSite(host);

      if (success) {
        // Update UI to show blocked status
        blockStatusEl.textContent = 'Currently blocked';
        blockStatusEl.className = 'blocked';
        blockBtn.style.display = 'none';
        // Refresh blocklist to show the new site
        const updatedSites = await getSites();
        renderBlocklist(updatedSites);
      } else {
        // Show error state
        blockBtn.disabled = false;
        blockBtn.textContent = 'Failed to block - try again';
      }
    });
  }
});
