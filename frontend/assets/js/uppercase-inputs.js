(() => {
  "use strict";

  const excludedTypes = new Set([
    "password", "hidden", "checkbox", "radio", "file", "number", "date",
    "datetime-local", "month", "week", "time", "color", "range", "submit",
    "reset", "button", "image",
  ]);

  document.addEventListener("input", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
    if (
      field instanceof HTMLInputElement &&
      (excludedTypes.has(field.type) ||
        field.type === "email" ||
        field.name.toLowerCase() === "username" ||
        field.autocomplete.toLowerCase() === "username")
    ) return;
    const cursorStart = field.selectionStart;
    const cursorEnd = field.selectionEnd;
    const upperValue = field.value.toLocaleUpperCase("en-US");
    if (field.value === upperValue) return;
    field.value = upperValue;
    if (cursorStart !== null && cursorEnd !== null) {
      try {
        field.setSelectionRange(Math.min(cursorStart, upperValue.length), Math.min(cursorEnd, upperValue.length));
      } catch {
        // Some input types, such as email, do not support selection ranges.
      }
    }
  }, true);
})();
