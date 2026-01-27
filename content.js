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
 * Display the block screen for a blocked site
 * @param {string} blockedHost - The host that was blocked
 */
function showBlockScreen(blockedHost) {
  // Placeholder: Full UI implementation in US-004
  // For now, just log that we would show the block screen
  console.log('Miniblock: Would show block screen for:', blockedHost);
}
