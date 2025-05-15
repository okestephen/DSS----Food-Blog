export function escapeHTML(str) {

  if (typeof str !== "string") {
        if (str === null || str === undefined) return "";
        str = String(str); // Safely coerce to string (e.g., numbers)
    }
    
    return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
