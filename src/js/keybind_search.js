// keybind_search.js
document.addEventListener("keydown", function (event) {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    // Trigger on Ctrl+Shift+K (or ⌘+Shift+K)
    if (modifier && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();

        // Try to focus the search input
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput) {
            searchInput.focus();
            searchInput.select(); // highlight existing text if any
        }
    }
});


