import crypto from "crypto";
import axios from "axios";

export async function isPwned(password) {
  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    // Call pwnedpassword API to check if password is pwned
    const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);
    const lines = response.data.split("\n");

    for (const line of lines) {
      const [hashSuffix, count] = line.split(":");
      if (hashSuffix.trim() === suffix) {
        return true; // password is pwned
      }
    }

    return false;
  } catch (err) {
    console.error("Pwned password API failed:", err);
    // Fail-safe: assume safe if API is unreachable
    return false;
  }
}
