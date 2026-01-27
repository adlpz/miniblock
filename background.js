// Miniblock - Background Service Worker
// Handles site blocking detection and coordination

// Import storage module
importScripts('storage.js');

console.log('Miniblock background service worker loaded');

// Make storage functions available for the background script
// The storage.js file defines getSites, addSite, removeSite as global functions

// Placeholder for future functionality:
// - Listen to webNavigation.onCommitted
// - Check if URL matches blocked hosts
// - Inject content script to show block screen
