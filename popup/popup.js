// Miniblock - Popup Script
// Handles popup UI interactions

/**
 * Check if a host matches any blocked host using smart subdomain matching.
 * Returns the blocked host that matches, or null if not blocked.
 * @param {string} host - The host to check
 * @param {string[]} blockedHosts - Array of blocked hosts
 * @returns {string|null} The matching blocked host or null
 */
function getMatchingBlockedHost(host, blockedHosts) {
  if (!host || !blockedHosts || blockedHosts.length === 0) {
    return null;
  }

  const normalizedHost = host.toLowerCase().trim();

  for (const blockedHost of blockedHosts) {
    const normalizedBlocked = blockedHost.toLowerCase().trim();

    // Exact match
    if (normalizedHost === normalizedBlocked) {
      return normalizedBlocked;
    }

    // Subdomain match: if blocked host is "twitter.com",
    // then "mobile.twitter.com" should be blocked
    if (normalizedHost.endsWith('.' + normalizedBlocked)) {
      return normalizedBlocked;
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

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const currentHostEl = document.getElementById('current-host');
  const hostInfoEl = document.getElementById('host-info');
  const blockStatusEl = document.getElementById('block-status');
  const blockBtn = document.getElementById('block-btn');

  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    currentHostEl.textContent = 'No site detected';
    return;
  }

  // Parse the URL to get hostname
  let host;
  try {
    const url = new URL(tab.url);
    host = url.hostname.toLowerCase();
  } catch (e) {
    currentHostEl.textContent = 'Invalid URL';
    return;
  }

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
  const blockedHosts = await getSites();
  const matchingBlockedHost = getMatchingBlockedHost(host, blockedHosts);

  if (matchingBlockedHost) {
    // Site is blocked
    blockStatusEl.textContent = `Currently blocked${matchingBlockedHost !== host ? ` (via ${matchingBlockedHost})` : ''}`;
    blockStatusEl.className = 'blocked';
    blockBtn.style.display = 'none';
  } else {
    // Site is not blocked - show block button
    blockStatusEl.textContent = '';
    blockBtn.style.display = 'block';

    // Update button text to show what will be blocked
    if (subdomain) {
      blockBtn.textContent = `Block ${host}`;
    } else {
      blockBtn.textContent = `Block ${host}`;
    }

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
      } else {
        // Show error state
        blockBtn.disabled = false;
        blockBtn.textContent = 'Failed to block - try again';
      }
    });
  }
});
