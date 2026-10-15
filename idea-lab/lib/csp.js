// The rules a generated prototype runs under, in production and in the build's browser test alike.
// sandbox without allow-same-origin: its script can never reach the idea lab's own pages or data.
export const APP_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts";
