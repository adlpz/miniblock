// Miniblock - Content Script
// Handles block screen display and bypass mechanism

console.log('Miniblock content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_BLOCK_SCREEN') {
    console.log('Miniblock: Received block request for:', message.blockedHost);
    showBlockScreen(message.blockedHost);
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});

/**
 * Generate the CSS styles for the block screen
 * Uses CSS variables for dark/light mode support via prefers-color-scheme
 * @returns {string} CSS styles
 */
function getBlockScreenStyles() {
  return `
    :root {
      --mb-bg: #ffffff;
      --mb-text: #1a1a1a;
      --mb-text-muted: #666666;
      --mb-input-bg: #f5f5f5;
      --mb-input-border: #cccccc;
      --mb-input-focus: #0066cc;
      --mb-link: #0066cc;
      --mb-error: #cc0000;
      --mb-success: #2e7d32;
      --mb-remove-bg: #e0e0e0;
      --mb-remove-hover: #cc0000;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --mb-bg: #1a1a1a;
        --mb-text: #f0f0f0;
        --mb-text-muted: #999999;
        --mb-input-bg: #2a2a2a;
        --mb-input-border: #444444;
        --mb-input-focus: #4d9fff;
        --mb-link: #4d9fff;
        --mb-error: #ff6666;
        --mb-success: #66bb6a;
        --mb-remove-bg: #444444;
        --mb-remove-hover: #ef5350;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body, html {
      height: 100%;
      width: 100%;
      overflow: hidden;
    }

    #miniblock-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: var(--mb-bg);
      color: var(--mb-text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
    }

    #miniblock-screen .mb-container {
      text-align: center;
      max-width: 400px;
      padding: 20px;
    }

    #miniblock-screen .mb-site-name {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 24px;
    }

    #miniblock-screen .mb-input-wrapper {
      margin-bottom: 16px;
    }

    #miniblock-screen .mb-input {
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      background: var(--mb-input-bg);
      border: 1px solid var(--mb-input-border);
      border-radius: 8px;
      color: var(--mb-text);
      outline: none;
      transition: border-color 0.2s;
    }

    #miniblock-screen .mb-input:focus {
      border-color: var(--mb-input-focus);
    }

    #miniblock-screen .mb-input::placeholder {
      color: var(--mb-text-muted);
    }

    #miniblock-screen .mb-error {
      color: var(--mb-error);
      font-size: 14px;
      margin-top: 8px;
      min-height: 20px;
      visibility: hidden;
    }

    #miniblock-screen .mb-error.visible {
      visibility: visible;
    }

    #miniblock-screen .mb-manage-link {
      margin-top: 24px;
    }

    #miniblock-screen .mb-manage-link a {
      color: var(--mb-link);
      text-decoration: none;
      font-size: 14px;
    }

    #miniblock-screen .mb-manage-link a:hover {
      text-decoration: underline;
    }

    #miniblock-screen .mb-manage-link a:focus {
      outline: 2px solid var(--mb-input-focus);
      outline-offset: 2px;
    }

    /* Blocklist panel styles */
    #miniblock-screen .mb-blocklist-panel {
      display: none;
      margin-top: 24px;
      text-align: left;
      width: 100%;
    }

    #miniblock-screen .mb-blocklist-panel.visible {
      display: block;
    }

    #miniblock-screen .mb-blocklist-header {
      font-size: 14px;
      font-weight: 600;
      color: var(--mb-text-muted);
      margin-bottom: 12px;
    }

    #miniblock-screen .mb-add-site-form {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    #miniblock-screen .mb-add-site-input {
      flex: 1;
      padding: 10px 12px;
      font-size: 14px;
      background: var(--mb-input-bg);
      border: 1px solid var(--mb-input-border);
      border-radius: 6px;
      color: var(--mb-text);
      outline: none;
    }

    #miniblock-screen .mb-add-site-input:focus {
      border-color: var(--mb-input-focus);
    }

    #miniblock-screen .mb-add-site-input::placeholder {
      color: var(--mb-text-muted);
    }

    #miniblock-screen .mb-add-site-btn {
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: var(--mb-success);
      color: #fff;
      transition: opacity 0.15s;
    }

    #miniblock-screen .mb-add-site-btn:hover {
      opacity: 0.9;
    }

    #miniblock-screen .mb-add-site-btn:focus {
      outline: 2px solid var(--mb-success);
      outline-offset: 2px;
    }

    #miniblock-screen .mb-add-site-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #miniblock-screen .mb-add-site-error {
      color: var(--mb-error);
      font-size: 12px;
      min-height: 16px;
      margin-bottom: 8px;
    }

    #miniblock-screen .mb-blocklist {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 200px;
      overflow-y: auto;
    }

    #miniblock-screen .mb-blocklist-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--mb-input-bg);
      border-radius: 6px;
    }

    #miniblock-screen .mb-blocklist-item-host {
      font-size: 14px;
      word-break: break-all;
    }

    #miniblock-screen .mb-remove-btn {
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      background: var(--mb-remove-bg);
      color: var(--mb-text-muted);
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
      margin-left: 8px;
    }

    #miniblock-screen .mb-remove-btn:hover {
      background: var(--mb-remove-hover);
      color: #fff;
    }

    #miniblock-screen .mb-remove-btn:focus {
      outline: 2px solid var(--mb-remove-hover);
      outline-offset: 2px;
    }

    #miniblock-screen .mb-blocklist-empty {
      font-size: 13px;
      color: var(--mb-text-muted);
      text-align: center;
      padding: 12px;
    }
  `;
}

/**
 * Generate the HTML for the block screen
 * @param {string} blockedHost - The host that was blocked
 * @returns {string} HTML content
 */
function getBlockScreenHTML(blockedHost) {
  return `
    <div class="mb-container">
      <div class="mb-site-name">${escapeHtml(blockedHost)}</div>
      <div class="mb-input-wrapper">
        <input
          type="text"
          class="mb-input"
          id="miniblock-bypass-input"
          placeholder="Type ${escapeHtml(blockedHost)} to continue"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <div class="mb-error" id="miniblock-error">Incorrect domain</div>
      </div>
      <div class="mb-manage-link">
        <a href="#" id="miniblock-manage-link">Manage blocklist</a>
      </div>
      <div class="mb-blocklist-panel" id="miniblock-blocklist-panel">
        <div class="mb-blocklist-header">Blocked Sites</div>
        <div class="mb-add-site-form">
          <input
            type="text"
            class="mb-add-site-input"
            id="miniblock-add-site-input"
            placeholder="Add site (e.g., twitter.com)"
            autocomplete="off"
          />
          <button type="button" class="mb-add-site-btn" id="miniblock-add-site-btn">Add</button>
        </div>
        <div class="mb-add-site-error" id="miniblock-add-site-error"></div>
        <ul class="mb-blocklist" id="miniblock-blocklist"></ul>
        <div class="mb-blocklist-empty" id="miniblock-blocklist-empty">No blocked sites yet</div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
 * Render the blocklist in the panel
 * @param {string[]} sites - Array of blocked hosts
 */
function renderBlocklist(sites) {
  const blocklistEl = document.getElementById('miniblock-blocklist');
  const emptyEl = document.getElementById('miniblock-blocklist-empty');

  if (!blocklistEl) return;

  blocklistEl.innerHTML = '';

  // Sort sites alphabetically
  const sortedSites = [...sites].sort((a, b) => a.localeCompare(b));

  if (sortedSites.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
  }

  for (const site of sortedSites) {
    const li = document.createElement('li');
    li.className = 'mb-blocklist-item';

    const hostSpan = document.createElement('span');
    hostSpan.className = 'mb-blocklist-item-host';
    hostSpan.textContent = site;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'mb-remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', async () => {
      removeBtn.disabled = true;
      removeBtn.textContent = '...';
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'REMOVE_SITE',
          host: site
        });
        if (response.success) {
          // Refresh the blocklist
          const sitesResponse = await chrome.runtime.sendMessage({ type: 'GET_SITES' });
          if (sitesResponse.success) {
            renderBlocklist(sitesResponse.sites);
          }
        } else {
          removeBtn.disabled = false;
          removeBtn.textContent = 'Error';
        }
      } catch (error) {
        console.error('Miniblock: Error removing site:', error);
        removeBtn.disabled = false;
        removeBtn.textContent = 'Error';
      }
    });

    li.appendChild(hostSpan);
    li.appendChild(removeBtn);
    blocklistEl.appendChild(li);
  }
}

/**
 * Display the block screen for a blocked site
 * @param {string} blockedHost - The host that was blocked
 */
function showBlockScreen(blockedHost) {
  // Check if block screen already exists
  if (document.getElementById('miniblock-screen')) {
    return;
  }

  // Wait for document body to be available
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => showBlockScreen(blockedHost));
    return;
  }

  // Create and inject styles
  const styleElement = document.createElement('style');
  styleElement.id = 'miniblock-styles';
  styleElement.textContent = getBlockScreenStyles();
  document.head.appendChild(styleElement);

  // Hide original page content
  document.body.style.overflow = 'hidden';

  // Create block screen element
  const blockScreen = document.createElement('div');
  blockScreen.id = 'miniblock-screen';
  blockScreen.innerHTML = getBlockScreenHTML(blockedHost);
  document.body.appendChild(blockScreen);

  // Set up event handlers
  const input = document.getElementById('miniblock-bypass-input');
  const errorElement = document.getElementById('miniblock-error');
  const manageLink = document.getElementById('miniblock-manage-link');

  // Focus the input field
  input.focus();

  // Handle Enter key on input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      attemptBypass(input.value, blockedHost, errorElement);
    }
  });

  // Clear error when user types
  input.addEventListener('input', () => {
    errorElement.classList.remove('visible');
  });

  // Handle manage blocklist link click
  const blocklistPanel = document.getElementById('miniblock-blocklist-panel');
  const addSiteInput = document.getElementById('miniblock-add-site-input');
  const addSiteBtn = document.getElementById('miniblock-add-site-btn');
  const addSiteError = document.getElementById('miniblock-add-site-error');

  manageLink.addEventListener('click', async (e) => {
    e.preventDefault();

    // Toggle panel visibility
    if (blocklistPanel.classList.contains('visible')) {
      blocklistPanel.classList.remove('visible');
      manageLink.textContent = 'Manage blocklist';
    } else {
      blocklistPanel.classList.add('visible');
      manageLink.textContent = 'Hide blocklist';

      // Load and render the blocklist
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SITES' });
        if (response.success) {
          renderBlocklist(response.sites);
        }
      } catch (error) {
        console.error('Miniblock: Error loading blocklist:', error);
      }
    }
  });

  // Handle add site form
  async function handleAddSite() {
    const validation = validateHostInput(addSiteInput.value);

    if (!validation.valid) {
      addSiteError.textContent = validation.error;
      return;
    }

    addSiteError.textContent = '';
    addSiteBtn.disabled = true;
    addSiteBtn.textContent = '...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_SITE',
        host: validation.host
      });

      if (response.success) {
        addSiteInput.value = '';
        // Refresh the blocklist
        const sitesResponse = await chrome.runtime.sendMessage({ type: 'GET_SITES' });
        if (sitesResponse.success) {
          renderBlocklist(sitesResponse.sites);
        }
      } else {
        addSiteError.textContent = 'Failed to add site';
      }
    } catch (error) {
      console.error('Miniblock: Error adding site:', error);
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

  // Clear error when typing in add site input
  addSiteInput.addEventListener('input', () => {
    addSiteError.textContent = '';
  });
}

/**
 * Attempt to bypass the block by checking if entered text matches the blocked host
 * @param {string} enteredText - Text entered by user
 * @param {string} blockedHost - The blocked host to match
 * @param {HTMLElement} errorElement - Element to show error message
 */
function attemptBypass(enteredText, blockedHost, errorElement) {
  const normalizedInput = enteredText.toLowerCase().trim();
  const normalizedHost = blockedHost.toLowerCase().trim();

  if (normalizedInput === normalizedHost) {
    // Bypass successful - notify background script
    console.log('Miniblock: Bypass successful for:', blockedHost);

    // Send message to background script to register the bypass
    chrome.runtime.sendMessage({
      type: 'BYPASS_GRANTED',
      host: normalizedHost
    }).then(() => {
      // Remove block screen after bypass is registered
      removeBlockScreen();
    }).catch((error) => {
      console.error('Miniblock: Failed to register bypass:', error);
      // Still remove block screen even if message fails
      removeBlockScreen();
    });
  } else {
    // Show error
    errorElement.classList.add('visible');
  }
}

/**
 * Remove the block screen and restore normal page view
 */
function removeBlockScreen() {
  const blockScreen = document.getElementById('miniblock-screen');
  const styleElement = document.getElementById('miniblock-styles');

  if (blockScreen) {
    blockScreen.remove();
  }
  if (styleElement) {
    styleElement.remove();
  }

  document.body.style.overflow = '';
}
