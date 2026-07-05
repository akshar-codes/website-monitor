const normalizeUrl = (urlString) => {
  const parsed = new URL(urlString); // throws on invalid input

  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  // Remove trailing slashes from the serialised URL
  return parsed.toString().replace(/\/+$/, "");
};

module.exports = normalizeUrl;
