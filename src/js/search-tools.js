const searchInput = document.getElementById("search-input");

searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase();
    const cards = document.querySelectorAll("#cards-container > .group");

    cards.forEach(card => {
        // Get the name text inside the card
        const name = card.querySelector(".accordion-header span.text-base")?.textContent.toLowerCase() || "";

        if (name.includes(query)) {
            card.style.display = "flex"; // show the card
        } else {
            card.style.display = "none"; // hide the card
        }
    });
});
