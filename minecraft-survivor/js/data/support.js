/* ============ support.js — the tip jar (Support screen, js/ui/support-ui.js) ============
 * The only place for the tip links. An empty `coffee` hides the "Buy me a coffee" button;
 * the Solana QR code is drawn from `solana` at runtime (js/core/qr.js), so changing the
 * address here is enough.
 */
G.SUPPORT = {
  // Buy Me a Coffee page, e.g. 'https://buymeacoffee.com/yourname' (https only). Empty: hidden.
  coffee: 'https://buymeacoffee.com/nokiademon',
  // Solana wallet address (base58). The QR code encodes `solana:<address>`.
  solana: '3SivNBoc62QvZsSEJxaJM9efjyeGV1NKpQMy4vUrnHWp'
};
