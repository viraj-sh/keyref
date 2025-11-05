function toggleAccordion(id, header) {
    const target = document.getElementById(id);
    const icon = header.querySelector('.accordion-icon');

    // Close others
    document.querySelectorAll('[id^="accordionCard"]').forEach(b => {
        if (b !== target) {
            b.style.display = "none";
            b.classList.add('hidden');
        }
    });
    document.querySelectorAll('.accordion-icon').forEach(svg => svg.classList.remove('rotate-180'));

    // Toggle current
    if (target.classList.contains('hidden')) {
        target.classList.remove('hidden');
        target.style.display = "block";
        icon.classList.add('rotate-180');
    } else {
        target.classList.add('hidden');
        target.style.display = "none";
        icon.classList.remove('rotate-180');
    }
}
