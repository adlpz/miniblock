// Miniblock - Storage Module
// Handles blocklist and schedule storage using Chrome sync API

const STORAGE_KEY = 'blocklist';
const SCHEDULE_KEY = 'schedule';

/**
 * Migrate old string[] format to {host, mode}[] format
 * @param {any[]} sites - Raw sites data from storage
 * @returns {Array<{host: string, mode: string}>} Migrated sites
 */
function migrateSites(sites) {
  if (!Array.isArray(sites) || sites.length === 0) {
    return [];
  }

  // Check if already in new format (first item is an object with 'host')
  if (typeof sites[0] === 'object' && sites[0] !== null && 'host' in sites[0]) {
    return sites;
  }

  // Old format: string[] → convert to {host, mode: 'always'}[]
  if (typeof sites[0] === 'string') {
    return sites.map(host => ({ host, mode: 'always' }));
  }

  return [];
}

/**
 * Get all blocked sites from storage
 * @returns {Promise<Array<{host: string, mode: string}>>} Array of blocked site entries
 */
async function getSites() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY] || [];
    const sites = migrateSites(raw);

    // Write back if migration happened (old format detected)
    if (raw.length > 0 && typeof raw[0] === 'string') {
      try {
        await chrome.storage.sync.set({ [STORAGE_KEY]: sites });
      } catch (e) {
        // Best-effort migration write-back
      }
    }

    return sites;
  } catch (error) {
    console.error('Miniblock: Error getting sites from sync storage:', error);
    // Try local storage as fallback
    try {
      const localResult = await chrome.storage.local.get(STORAGE_KEY);
      const raw = localResult[STORAGE_KEY] || [];
      return migrateSites(raw);
    } catch (localError) {
      console.error('Miniblock: Error getting sites from local storage:', localError);
      return [];
    }
  }
}

/**
 * Add a site to the blocklist
 * @param {string} host - The hostname to block
 * @param {string} mode - Blocking mode: 'always' or 'scheduled'
 * @returns {Promise<boolean>} True if successful
 */
async function addSite(host, mode = 'always') {
  if (!host || typeof host !== 'string') {
    console.error('Miniblock: Invalid host provided to addSite');
    return false;
  }

  // Normalize the host (lowercase, trim whitespace)
  const normalizedHost = host.toLowerCase().trim();
  if (!normalizedHost) {
    return false;
  }

  try {
    const sites = await getSites();

    // Check if already blocked
    if (sites.some(s => s.host === normalizedHost)) {
      return true; // Already blocked, consider it success
    }

    const updatedSites = [...sites, { host: normalizedHost, mode }];

    // Try sync storage first
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: updatedSites });
    } catch (syncError) {
      console.error('Miniblock: Sync storage failed, using local storage:', syncError);
      // Fallback to local storage
      await chrome.storage.local.set({ [STORAGE_KEY]: updatedSites });
    }

    return true;
  } catch (error) {
    console.error('Miniblock: Error adding site:', error);
    return false;
  }
}

/**
 * Remove a site from the blocklist
 * @param {string} host - The hostname to unblock
 * @returns {Promise<boolean>} True if successful
 */
async function removeSite(host) {
  if (!host || typeof host !== 'string') {
    console.error('Miniblock: Invalid host provided to removeSite');
    return false;
  }

  const normalizedHost = host.toLowerCase().trim();
  if (!normalizedHost) {
    return false;
  }

  try {
    const sites = await getSites();
    const updatedSites = sites.filter(s => s.host !== normalizedHost);

    // No change needed if site wasn't in list
    if (updatedSites.length === sites.length) {
      return true;
    }

    // Try sync storage first
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: updatedSites });
    } catch (syncError) {
      console.error('Miniblock: Sync storage failed, using local storage:', syncError);
      // Fallback to local storage
      await chrome.storage.local.set({ [STORAGE_KEY]: updatedSites });
    }

    return true;
  } catch (error) {
    console.error('Miniblock: Error removing site:', error);
    return false;
  }
}

/**
 * Update the blocking mode for an existing site
 * @param {string} host - The hostname to update
 * @param {string} mode - New mode: 'always' or 'scheduled'
 * @returns {Promise<boolean>} True if successful
 */
async function updateSiteMode(host, mode) {
  if (!host || typeof host !== 'string') {
    return false;
  }

  const normalizedHost = host.toLowerCase().trim();
  if (!normalizedHost || (mode !== 'always' && mode !== 'scheduled')) {
    return false;
  }

  try {
    const sites = await getSites();
    const entry = sites.find(s => s.host === normalizedHost);
    if (!entry) {
      return false;
    }

    entry.mode = mode;

    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: sites });
    } catch (syncError) {
      console.error('Miniblock: Sync storage failed, using local storage:', syncError);
      await chrome.storage.local.set({ [STORAGE_KEY]: sites });
    }

    return true;
  } catch (error) {
    console.error('Miniblock: Error updating site mode:', error);
    return false;
  }
}

/**
 * Validate a schedule window
 * @param {string} start - Start time in HH:MM format
 * @param {string} end - End time in HH:MM format
 * @returns {{valid: boolean, error: string}}
 */
function validateScheduleWindow(start, end) {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (!timeRegex.test(start)) {
    return { valid: false, error: 'Invalid start time format (use HH:MM)' };
  }
  if (!timeRegex.test(end)) {
    return { valid: false, error: 'Invalid end time format (use HH:MM)' };
  }
  if (start >= end) {
    return { valid: false, error: 'Start time must be before end time' };
  }

  return { valid: true, error: '' };
}

/**
 * Check if a new window overlaps with existing windows
 * @param {Array<{start: string, end: string}>} windows - Existing windows
 * @param {{start: string, end: string}} newWindow - New window to check
 * @returns {boolean} True if overlap exists
 */
function hasOverlap(windows, newWindow) {
  for (const w of windows) {
    // Overlap if one starts before the other ends and vice versa
    if (newWindow.start < w.end && newWindow.end > w.start) {
      return true;
    }
  }
  return false;
}

/**
 * Get the schedule from storage
 * @returns {Promise<{windows: Array<{start: string, end: string}>}>}
 */
async function getSchedule() {
  try {
    const result = await chrome.storage.sync.get(SCHEDULE_KEY);
    return result[SCHEDULE_KEY] || { windows: [] };
  } catch (error) {
    console.error('Miniblock: Error getting schedule:', error);
    return { windows: [] };
  }
}

/**
 * Save the schedule to storage
 * @param {{windows: Array<{start: string, end: string}>}} schedule
 * @returns {Promise<boolean>} True if successful
 */
async function setSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule.windows)) {
    return false;
  }

  // Validate all windows
  for (const w of schedule.windows) {
    const validation = validateScheduleWindow(w.start, w.end);
    if (!validation.valid) {
      return false;
    }
  }

  // Check for overlaps between windows
  for (let i = 0; i < schedule.windows.length; i++) {
    const others = schedule.windows.filter((_, j) => j !== i);
    if (hasOverlap(others, schedule.windows[i])) {
      return false;
    }
  }

  try {
    await chrome.storage.sync.set({ [SCHEDULE_KEY]: schedule });
    return true;
  } catch (error) {
    console.error('Miniblock: Error saving schedule:', error);
    return false;
  }
}

// Export for use in other scripts
// In service worker context, use self; in content scripts, use window
const exportTarget = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {});
exportTarget.getSites = getSites;
exportTarget.addSite = addSite;
exportTarget.removeSite = removeSite;
exportTarget.updateSiteMode = updateSiteMode;
exportTarget.getSchedule = getSchedule;
exportTarget.setSchedule = setSchedule;
exportTarget.validateScheduleWindow = validateScheduleWindow;
exportTarget.hasOverlap = hasOverlap;
exportTarget.miniblockStorage = { getSites, addSite, removeSite, updateSiteMode, getSchedule, setSchedule, validateScheduleWindow, hasOverlap };
