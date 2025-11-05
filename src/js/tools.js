(async function () {
  const container = document.getElementById("cards-container");
  if (!container) return;

  const dataUrl = "/data/tools.json";

  // Try fetching the JSON file
  let data;
  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("tools.json not found");
    data = await res.json();
  } catch (err) {
    console.warn("⚠️ tools.json not found or failed to load:", err.message);
    return; // keep skeletons visible
  }

  if (!data?.tools?.length) {
    console.warn("No tools found in JSON");
    return;
  }

  // Remove skeletons if function exists
  if (window.clearSkeletons) window.clearSkeletons();

  // Populate cards dynamically
  data.tools.forEach((tool, index) => {
    const id = `accordionCard${tool.id || index}`;
    const name = tool.name || "Untitled";
    const slug = tool.slug || "unknown";

    // Construct image URL using slug
    const logoUrl = `https://www.shortcutfoo.com/_next/image?url=%2F${slug.split("-")[0]}.png&w=64&q=75`;
    const fallbackLogo =
      "https://www.shortcutfoo.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fscf_logo_white.0dd0a032.png&w=64&q=75";

    const cardHTML = `
      <div class="group flex flex-col w-[322px] border border-slate-700 hover:border-[#ff4b4b] rounded-lg bg-slate-900 shadow-md shadow-slate-950/30 overflow-hidden"
           data-accordion-container data-accordion-mode="exclusive">

        <!-- Accordion Header -->
        <div class="accordion-header flex items-center justify-between w-full py-4 px-4 text-left font-semibold cursor-pointer text-gray-200 hover:text-white transition-colors"
             onclick="toggleAccordion('${id}', this)" aria-expanded="false">
          <div class="flex items-center space-x-3">
            <img src="${logoUrl}" alt="${slug} logo"
                 class="w-8 h-8 rounded-md object-contain"
                 onerror="this.onerror=null;this.src='${fallbackLogo}'">
            <div class="flex flex-col leading-tight">
              <span class="text-base text-gray-200 font-medium truncate">${name}</span>
              <span class="text-xs text-gray-500/70">${slug}</span>
            </div>
          </div>
          <svg width="1.5em" height="1.5em" viewBox="0 0 24 24" fill="none"
               xmlns="http://www.w3.org/2000/svg" color="currentColor"
               class="accordion-icon h-4 w-4 transition-transform duration-300">
            <path d="M6 9L12 15L18 9"
                  stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </div>

        <!-- Accordion Body -->
        <div id="${id}" class="hidden border-t border-slate-700 px-4 py-3">
          <p class="text-sm text-gray-300 mb-4">
            Keyboard shortcuts and commands for ${name}.
          </p>
          <div class="flex justify-between gap-2">
            <button
              onclick="window.location.href='/src/pages/cheatsheet.html?slug=${slug}'"
              class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-200 font-medium hover:border-[#ff4b4b] transition-all duration-200">
              View
            </button>
            
            <button
              onclick="window.open('https://www.shortcutfoo.com/app/dojos/${slug}', '_blank')"
              class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-200 font-medium hover:border-[#ff4b4b] transition-all duration-200">
              Practice
            </button>
          </div>
        </div>
      </div>
    `;
    // <button
    // class="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-gray-200 font-medium hover:border-[#ff4b4b] transition-all duration-200" >
    //   Download
    //         </button >
    container.insertAdjacentHTML("beforeend", cardHTML);
  });
})();

