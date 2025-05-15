// XSS mitigation and input validation
export function escapeHTML(str) {

  if (typeof str !== "string") {
        if (str === null || str === undefined) return "";
        str = String(str); // Safely change to string
    }
    
    return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
