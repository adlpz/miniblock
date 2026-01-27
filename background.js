// Miniblock - Background Service Worker
// Handles site blocking detection and coordination

// Import storage module
importScripts('storage.js');

console.log('Miniblock background service worker loaded');

// Track bypass state per tab: Map<tabId, Set<host>>
// When a tab has bypassed a host, that host won't be blocked for that tab
const tabBypasses = new Map();

/**
 * Check if a URL's host matches any blocked host using smart subdomain matching.
 * - If blocklist contains "twitter.com", it blocks twitter.com and all subdomains (mobile.twitter.com)
 * - If blocklist contains "mail.google.com", it only blocks mail.google.com (not google.com or other subdomains)
 * @param {string} urlString - The URL to check
 * @param {string[]} blockedHosts - Array of blocked hosts
 * @returns {string|null} The blocked host that matched, or null if not blocked
 */
function isBlocked(urlString, blockedHosts) {
  if (!urlString || !blockedHosts || blockedHosts.length === 0) {
    return null;
  }

  let host;
  try {
    const url = new URL(urlString);
    host = url.hostname.toLowerCase();
  } catch (e) {
    return null;
  }

  for (const blockedHost of blockedHosts) {
    const normalizedBlocked = blockedHost.toLowerCase().trim();

    // Exact match
    if (host === normalizedBlocked) {
      return normalizedBlocked;
    }

    // Subdomain match: if blocked host is "twitter.com",
    // then "mobile.twitter.com" should be blocked
    // Check if host ends with ".blockedHost"
    if (host.endsWith('.' + normalizedBlocked)) {
      return normalizedBlocked;
    }
  }

  return null;
}

// Listen for navigation events to detect blocked sites
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only handle main frame navigations (not iframes)
  if (details.frameId !== 0) {
    return;
  }

  // Skip chrome:// and extension pages
  if (details.url.startsWith('chrome://') || details.url.startsWith('chrome-extension://')) {
    return;
  }

  try {
    const blockedHosts = await getSites();
    const matchedHost = isBlocked(details.url, blockedHosts);

    if (matchedHost) {
      // Check if this tab has an active bypass for this host
      if (hasActiveBypass(details.tabId, matchedHost)) {
        console.log('Miniblock: Bypass active for', matchedHost, 'on tab', details.tabId);
        return;
      }

      // Send message to content script to show block screen
      chrome.tabs.sendMessage(details.tabId, {
        type: 'SHOW_BLOCK_SCREEN',
        blockedHost: matchedHost,
        url: details.url
      }).catch((error) => {
        // Content script might not be ready yet, retry after a short delay
        setTimeout(() => {
          chrome.tabs.sendMessage(details.tabId, {
            type: 'SHOW_BLOCK_SCREEN',
            blockedHost: matchedHost,
            url: details.url
          }).catch(() => {
            // Silently fail if still can't reach content script
          });
        }, 100);
      });
    }
  } catch (error) {
    console.error('Miniblock: Error checking blocked status:', error);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BYPASS_GRANTED') {
    const tabId = sender.tab?.id;
    const host = message.host?.toLowerCase().trim();

    if (tabId && host) {
      // Add bypass for this tab
      if (!tabBypasses.has(tabId)) {
        tabBypasses.set(tabId, new Set());
      }
      tabBypasses.get(tabId).add(host);
      console.log('Miniblock: Bypass granted for', host, 'on tab', tabId);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Invalid tab or host' });
    }
  }

  // Storage operations for content script blocklist management
  if (message.type === 'GET_SITES') {
    getSites().then(sites => {
      sendResponse({ success: true, sites });
    }).catch(error => {
      console.error('Miniblock: Error getting sites:', error);
      sendResponse({ success: false, error: error.message });
    });
  }

  if (message.type === 'ADD_SITE') {
    const host = message.host?.toLowerCase().trim();
    if (!host) {
      sendResponse({ success: false, error: 'Invalid host' });
    } else {
      addSite(host).then(success => {
        sendResponse({ success });
      }).catch(error => {
        console.error('Miniblock: Error adding site:', error);
        sendResponse({ success: false, error: error.message });
      });
    }
  }

  if (message.type === 'REMOVE_SITE') {
    const host = message.host?.toLowerCase().trim();
    if (!host) {
      sendResponse({ success: false, error: 'Invalid host' });
    } else {
      removeSite(host).then(success => {
        sendResponse({ success });
      }).catch(error => {
        console.error('Miniblock: Error removing site:', error);
        sendResponse({ success: false, error: error.message });
      });
    }
  }

  // Check if first bypass tooltip has been shown
  if (message.type === 'CHECK_FIRST_BYPASS_SHOWN') {
    chrome.storage.local.get(['firstBypassTooltipShown'], (result) => {
      sendResponse({ shown: !!result.firstBypassTooltipShown });
    });
  }

  // Mark first bypass tooltip as shown
  if (message.type === 'SET_FIRST_BYPASS_SHOWN') {
    chrome.storage.local.set({ firstBypassTooltipShown: true }, () => {
      sendResponse({ success: true });
    });
  }

  return true; // Keep message channel open for async response
});

// Clean up bypass state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabBypasses.has(tabId)) {
    console.log('Miniblock: Clearing bypasses for closed tab', tabId);
    tabBypasses.delete(tabId);
  }
});

/**
 * Check if a tab has an active bypass for a given host
 * @param {number} tabId - The tab ID
 * @param {string} host - The host to check (should already be normalized)
 * @returns {boolean} True if bypass is active
 */
function hasActiveBypass(tabId, host) {
  if (!tabBypasses.has(tabId)) {
    return false;
  }

  const bypasses = tabBypasses.get(tabId);
  const normalizedHost = host.toLowerCase().trim();

  // Check for exact match
  if (bypasses.has(normalizedHost)) {
    return true;
  }

  // Check for subdomain match: if user bypassed "twitter.com",
  // navigating to "mobile.twitter.com" should also be allowed
  for (const bypassedHost of bypasses) {
    if (normalizedHost.endsWith('.' + bypassedHost)) {
      return true;
    }
  }

  return false;
}

// Export isBlocked for potential use by other parts of the extension
self.isBlocked = isBlocked;
