// Shared by the generated HTML and the local HTTP server; no production backend traffic.
export const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'";
