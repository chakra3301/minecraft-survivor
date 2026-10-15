/* ============ support-ui.js — "Support the game" ============
 * Main menu → Support the game. A short note and the tip jar: a "Buy me a coffee"
 * link (hidden until G.SUPPORT.coffee is set, js/data/support.js) and the Solana
 * address with a Copy button and its QR code (drawn offline by js/core/qr.js).
 * Nothing is fetched: the links only open in a new tab when clicked.
 */
G.SupportUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let qrFor = '', qrSrc = '';

  function open() {
    const S = G.SUPPORT;
    const coffee = /^https:\/\//.test(S.coffee || '') ? S.coffee : '';
    // Drawn once per address.
    if (qrFor !== S.solana) { qrFor = S.solana; qrSrc = G.QR.dataURL('solana:' + S.solana, 5); }
    $('sup-body').innerHTML = `
      <p class="sup-lead">Minecraft Survivor is <b class="gold">free</b> and <b class="gold">open source</b>, made by a fan in their spare time:
        no ads, no purchases, nothing locked.</p>
      <p class="sub">If you enjoy it, a small tip helps pay for hosting and keeps the game online. Tipping gives nothing in the game: everyone plays the same.</p>
      <div class="sup-coffee">
        <a id="sup-coffee" class="btn gold${coffee ? '' : ' hidden'}" href="${esc(coffee)}" target="_blank" rel="noopener">${G.Icons.html('items/cookie', 20)} Buy me a coffee</a>
        <p id="sup-coffee-soon" class="note${coffee ? ' hidden' : ''}">Buy me a coffee: link coming soon.</p>
      </div>
      <div class="panel sup-sol">
        <img id="sup-qr" class="sup-qr" src="${qrSrc}" alt="QR code of the Solana address" width="205" height="205">
        <div class="sup-sol-txt">
          <h3>Tip with Solana</h3>
          <p class="sub">Scan the code with your wallet app, or copy the address. Send on the Solana network only.</p>
          <code id="sup-addr" class="sup-addr" translate="no">${esc(S.solana)}</code>
          <button id="sup-copy" class="btn" data-sfx="confirm">Copy address</button>
        </div>
      </div>
      <p class="note">You can also help for free: share the game with your friends and report bugs.</p>`;
    $('sup-copy').onclick = copy;
    G.UI.show('scr-support', true);
  }

  async function copy() {
    const addr = G.SUPPORT.solana;
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(addr); ok = true; } } catch (e) { /* fallback below */ }
    if (!ok) {
      // Older browsers / plain http: select the address and try the old copy command.
      const r = document.createRange();
      r.selectNodeContents($('sup-addr'));
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    }
    G.UI.toast(ok ? 'Copied!' : 'Address selected: copy it from there');
  }

  return { open, copy };
})();
