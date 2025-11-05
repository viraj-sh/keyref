document.addEventListener("DOMContentLoaded", async () => {
  const wrapper = document.querySelector(".cheatsheet-wrapper");
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    wrapper.innerHTML = `<div class="text-red-500 text-center text-lg">Missing slug in URL.</div>`;
    return;
  }

  try {
    const res = await fetch(`../../data/cheatsheet/${slug}.json`);
    if (!res.ok) throw new Error("Cheatsheet not found");
    const data = await res.json();
    renderCheatsheet(data);
  } catch (err) {
    wrapper.innerHTML = `<div class="text-red-500 text-center text-lg">${err.message}</div>`;
  }

  function renderCheatsheet(data) {
    const tool = data.tool;
    const description = tool.page_metadata?.cheat_sheet?.description || "";
    const units = tool.units || [];

    wrapper.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6">
        <h1 class="text-3xl font-bold text-gray-800">${tool.name}</h1>
        <p class="text-gray-600">${description}</p>
        <div class="space-y-6">${units.map(renderUnit).join("")}</div>
      </div>
    `;
  }

  function renderUnit(unit) {
    return `
      <div class="bg-slate-900 shadow-md rounded-2xl p-4">
        <h2 class="text-xl font-semibold mb-3 text-gray-800">${unit.name}</h2>
        <div class="space-y-3">
          ${unit.commands.map(renderCommand).join("")}
        </div>
      </div>
    `;
  }

  function renderCommand(command) {
    const shortcut = formatKeySequence(command.keySequences || []);
    return `
      <div class="rounded-xl p-3 hover:shadow-sm transition">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span class="font-medium text-gray-200">${command.name}</span>
          ${shortcut ? `<div class="flex flex-wrap gap-1">${shortcut}</div>` : ""}
        </div>
      </div>
    `;
  }
  function formatKeySequence(sequences) {
    if (!sequences.length) return "";

    const bins = sequences[0].keyBins.map(bin => normalizeKey(bin.key));
    const first = bins[0];
    const onlyOne = bins.length === 1;
    const hasCtrlCmdAlt = bins.some(b => b.ctrl || b.cmd || b.alt);

    // emacs special case
    if (slug === "emacs") {
      const isEmacsAltX =
        first?.alt && !first.cmd && !first.ctrl && !first.shift && first.key === "x";
      if (isEmacsAltX) {
        const keyPart = renderKeyCombo([first]);
        const commandPartBins = bins.slice(1);
        const textKeys = commandPartBins.filter(b => !isEnterToken(b));
        const commandText = textKeys.map(k => mapKeyToChar(k)).join("").trim();
        const commandPart = `<span class="font-mono bg-slate-800/80 text-gray-200 px-2 py-1 rounded">${commandText}</span>`;
        return `${keyPart} ${commandPart}`;
      }
    }

    // python-regex special case
    if (slug === "python-regex") {
      const hasModifiers = bins.some(b => b.ctrl || b.alt || b.cmd || b.shift);
      if (!hasModifiers) {
        const text = bins.map(k => mapKeyToChar(k)).join("").trim();
        if (text.length) {
          return `<span class="font-mono bg-slate-800/80 text-gray-200 px-2 py-1 rounded">${text}</span>`;
        }
      }
    }

    if (onlyOne && isPhysicalKey(first)) {
      return renderKeyCombo(bins);
    }

    if (!hasCtrlCmdAlt) {
      const textKeys = bins.filter(b => !isEnterToken(b));
      const allPrintable = textKeys.every(isPrintableCharacter);
      if (allPrintable) {
        const text = textKeys.map(k => mapKeyToChar(k)).join("");
        return `<span class="font-mono bg-slate-800/80 text-gray-200 px-2 py-1 rounded">${text.trim()}</span>`;
      }
    }

    return renderKeyCombo(bins);
  }


  // function formatKeySequence(sequences) {
  //   if (slug === "emacs") {
  //     const bins = sequences[0].keyBins.map(bin => normalizeKey(bin.key));
  //     const first = bins[0];
  //     const isEmacsAltX =
  //       first?.alt && !first.cmd && !first.ctrl && !first.shift && first.key === "x";

  //     if (isEmacsAltX) {
  //       const keyPart = renderKeyCombo([first]);
  //       const commandPartBins = bins.slice(1);
  //       const textKeys = commandPartBins.filter(b => !isEnterToken(b));
  //       const commandText = textKeys.map(k => mapKeyToChar(k)).join("").trim();
  //       const commandPart = `<span class="font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">${commandText}</span>`;
  //       return `${keyPart} ${commandPart}`;
  //     }
  //   }

  //   // Special handling for python-regex.json
  //   if (slug === "python-regex") {
  //     if (sequences.length && sequences[0].keyBins) {
  //       const bins = sequences[0].keyBins.map(bin => normalizeKey(bin.key));
  //       const hasModifiers = bins.some(b => b.ctrl || b.alt || b.cmd || b.shift);
  //       const printableText = bins.map(k => mapKeyToChar(k)).join("");
  //       // If it's all letters, digits, symbols, or brackets with no modifiers → treat as command text
  //       if (!hasModifiers && /^[\[\]\(\)\{\}a-zA-Z0-9_\-\+\=\.\,\;\:\\\/\s<>]+$/.test(printableText)) {
  //         return `<span class="font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">${printableText.trim()}</span>`;
  //       }
  //     }
  //   }


  //   if (!sequences.length) return "";
  //   const bins = sequences[0].keyBins.map(bin => normalizeKey(bin.key));
  //   const first = bins[0];
  //   const onlyOne = bins.length === 1;
  //   const hasCtrlCmdAlt = bins.some(b => b.ctrl || b.cmd || b.alt);

  //   if (onlyOne && isPhysicalKey(first)) {
  //     return renderKeyCombo(bins);
  //   }

  //   if (!hasCtrlCmdAlt) {
  //     const textKeys = bins.filter(b => !isEnterToken(b));
  //     const allPrintable = textKeys.every(isPrintableCharacter);
  //     if (allPrintable) {
  //       const text = textKeys.map(k => mapKeyToChar(k)).join("");
  //       return `<span class="font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">${text.trim()}</span>`;
  //     }
  //   }

  //   return renderKeyCombo(bins);
  // }

  function renderKeyCombo(keys) {
    return keys
      .map(k => {
        const combo = [];
        if (k.ctrl) combo.push("Ctrl");
        if (k.cmd) combo.push("Cmd");
        if (k.alt) combo.push("Alt");
        if (k.shift) combo.push("Shift");
        combo.push(formatKeyLabel(k.key, k.display));
        return `<kbd class="px-2 py-1 bg-slate-800/80 text-gray-200 hover:text-[#ff4b4b] rounded-lg border">${combo.join(" + ")}</kbd>`;
      })
      .join("");
  }

  function normalizeKey(k) {
    const copy = { ...k };
    copy.display = (k.keypress || k.key || "").toLowerCase();
    copy.key = (k.key || "").toLowerCase();

    if (copy.key === "↵" || copy.display === "↵") copy.key = "enter";
    if (copy.key === " ") copy.key = "space";

    const unicodeMap = {
      "\u001f": "-",
      "\u001c": "\\",
      "\u001b": "[",
      "\u001d": "]",
      "\u001e": "6",
      "…": ";",
      "\u001a": 'z'
    };
    if (unicodeMap[k.keypress]) {
      copy.key = unicodeMap[k.keypress];
      copy.display = unicodeMap[k.keypress];
    }

    return copy;
  }

  function isPhysicalKey(k) {
    const key = (k.key || "").toLowerCase();
    if (key === "enter" || key === "space") return true;
    if (["=", "-", "+", "_"].includes(key)) return true;
    if (key === "pagedown" || key === "pageup") return true;
    if (key.startsWith("f") && /^\d+$/.test(key.slice(1))) return true;
    return false;
  }

  function isPrintableCharacter(k) {
    const key = k.key;
    if (!key && key !== "") return false;
    if (isEnterToken(k)) return false;
    if (key === "space") return true;
    if (/^[a-zA-Z0-9]$/.test(key)) return true;
    if (/^[\-\=\[\]\\;,'\.\/`~!@#\$%\^&\*\(\)_\+\{\}\|:"<>\?]$/.test(key)) return true;
    return false;
  }

  function mapKeyToChar(k) {
    if (k.key === "space") return " ";
    if (/^[a-zA-Z]$/.test(k.key)) return k.shift ? k.key.toUpperCase() : k.key;
    const shiftMap = {
      "`": "~", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
      "6": "^", "7": "&", "8": "*", "9": "(", "0": ")", "-": "_", "=": "+",
      "[": "{", "]": "}", "\\": "|", ";": ":", "'": "\"", ",": "<", ".": ">", "/": "?"
    };
    if (k.shift && shiftMap[k.key] !== undefined) return shiftMap[k.key];
    return k.key;
  }

  function isEnterToken(k) {
    const key = (k.key || "").toLowerCase();
    return key === "enter" || key === "↵" || k.keypress?.toLowerCase() === "enter";
  }

  function formatKeyLabel(key, display) {
    const shown = display || key;
    const lower = (shown || "").toLowerCase();
    if (lower === "pagedown") return "PgDn";
    if (lower === "pageup") return "PgUp";
    if (lower.startsWith("f") && /^\d+$/.test(lower.slice(1))) return lower.toUpperCase();
    const special = {
      "cmd": "⌘",
      "ctrl": "Ctrl",
      "alt": "Alt",
      "shift": "Shift",
      "space": "Space",
      "tab": "Tab",
      "enter": "Enter",
      "↵": "Enter",
      "arrowup": "ArrowUp",
      "arrowdown": "ArrowDown",
      "arrowleft": "ArrowLeft",
      "arrowright": "ArrowRight"
    };
    return special[lower] || shown.toUpperCase();
  }
});
