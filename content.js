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
      --mb-error: #cc0000;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --mb-bg: #1a1a1a;
        --mb-text: #f0f0f0;
        --mb-text-muted: #999999;
        --mb-input-bg: #2a2a2a;
        --mb-input-border: #444444;
        --mb-input-focus: #4d9fff;
        --mb-error: #ff6666;
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

    #miniblock-screen .mb-hint {
      margin-top: 24px;
      font-size: 13px;
      color: var(--mb-text-muted);
    }

    /* First-bypass tooltip styles */
    #miniblock-tooltip {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--mb-text);
      color: var(--mb-bg);
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 90vw;
      text-align: center;
    }

    #miniblock-tooltip.visible {
      opacity: 1;
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
      <div class="mb-hint">Manage blocklist via the Miniblock extension icon</div>
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
      // Show first-bypass tooltip if this is the first time
      showFirstBypassTooltip();
    }).catch((error) => {
      console.error('Miniblock: Failed to register bypass:', error);
      // Still remove block screen even if message fails
      removeBlockScreen();
      // Still try to show tooltip
      showFirstBypassTooltip();
    });
  } else {
    // Show error
    errorElement.classList.add('visible');
  }
}

/**
 * Show a tooltip on first bypass to inform user that bypass expires when tab closes
 */
async function showFirstBypassTooltip() {
  try {
    // Check if tooltip has already been shown
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_FIRST_BYPASS_SHOWN' });
    if (response.shown) {
      return;
    }

    // Mark as shown before displaying (to prevent race conditions)
    await chrome.runtime.sendMessage({ type: 'SET_FIRST_BYPASS_SHOWN' });

    // Create and show the tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'miniblock-tooltip';
    tooltip.textContent = 'Bypass expires when you close this tab';
    document.body.appendChild(tooltip);

    // Create styles if they don't exist (they were removed with block screen)
    let styleElement = document.getElementById('miniblock-tooltip-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'miniblock-tooltip-styles';
      styleElement.textContent = getTooltipStyles();
      document.head.appendChild(styleElement);
    }

    // Trigger fade in
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      tooltip.classList.remove('visible');
      // Remove element after fade out transition
      setTimeout(() => {
        tooltip.remove();
        if (styleElement) {
          styleElement.remove();
        }
      }, 300);
    }, 4000);
  } catch (error) {
    console.error('Miniblock: Error showing first bypass tooltip:', error);
  }
}

/**
 * Get CSS styles for the tooltip (standalone, for use after block screen is removed)
 * @returns {string} CSS styles
 */
function getTooltipStyles() {
  return `
    :root {
      --mb-bg: #ffffff;
      --mb-text: #1a1a1a;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --mb-bg: #1a1a1a;
        --mb-text: #f0f0f0;
      }
    }

    #miniblock-tooltip {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--mb-text);
      color: var(--mb-bg);
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 90vw;
      text-align: center;
    }

    #miniblock-tooltip.visible {
      opacity: 1;
    }
  `;
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
