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
  manageLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Placeholder for US-008: Will show blocklist management UI
    console.log('Miniblock: Manage blocklist clicked');
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
