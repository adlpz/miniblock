// Miniblock - Storage Module
// Handles blocklist storage using Chrome sync API

const STORAGE_KEY = 'blocklist';

/**
 * Get all blocked sites from storage
 * @returns {Promise<string[]>} Array of blocked hosts
 */
async function getSites() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  } catch (error) {
    console.error('Miniblock: Error getting sites from sync storage:', error);
    // Try local storage as fallback
    try {
      const localResult = await chrome.storage.local.get(STORAGE_KEY);
      return localResult[STORAGE_KEY] || [];
    } catch (localError) {
      console.error('Miniblock: Error getting sites from local storage:', localError);
      return [];
    }
  }
}

/**
 * Add a site to the blocklist
 * @param {string} host - The hostname to block
 * @returns {Promise<boolean>} True if successful
 */
async function addSite(host) {
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
    if (sites.includes(normalizedHost)) {
      return true; // Already blocked, consider it success
    }

    const updatedSites = [...sites, normalizedHost];

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
    const updatedSites = sites.filter(site => site !== normalizedHost);

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

// Export for use in other scripts
// In service worker context, use self; in content scripts, use window
const exportTarget = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : {});
exportTarget.getSites = getSites;
exportTarget.addSite = addSite;
exportTarget.removeSite = removeSite;
exportTarget.miniblockStorage = { getSites, addSite, removeSite };
