(function () {
    const container = document.getElementById('cards-container');
    const tpl = document.getElementById('skeleton-card-template');

    // Insert default number of skeletons (you can change this)
    const DEFAULT_SKELETON_COUNT = 6;

    function renderSkeletons(count = DEFAULT_SKELETON_COUNT) {
        // Clear any existing children (safety)
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            container.appendChild(tpl.content.cloneNode(true));
        }
    }

    // Call on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => renderSkeletons());
    } else {
        renderSkeletons();
    }

    // Expose a helper so your data-population script can remove skeletons easily:
    // Example usage from your loader: window.clearSkeletons(); then inject real cards.
    window.clearSkeletons = function () {
        // remove everything inside container so you can inject real cards
        container.innerHTML = '';
    };

    // Also expose a small helper to re-render skeletons if you want:
    window.showSkeletons = function (n = DEFAULT_SKELETON_COUNT) {
        renderSkeletons(n);
    };
})();