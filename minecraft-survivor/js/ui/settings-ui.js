/* ============ settings-ui.js — Settings screen (PC and mobile) ============
 * Opens on top of whatever is showing (menu or pause) and returns there on close.
 * Tabs: Sound · Graphics · Controls · Account · About.
 * Settings belong to this device (G.Settings / G.Audio in the browser).
 */
G.SettingsUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERSION = '1.0 · 2026-10-13';
  let tab = 'sound';

  function init() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => { b.onclick = () => { tab = b.dataset.t; render(); }; });
    $('set-close').onclick = close;
    $('btn-settings').innerHTML = G.Icons.html('gear', 20);
    $('btn-settings').onclick = () => open();
    $('btn-pause-settings').onclick = () => open('sound');
    // Fullscreen (if the browser allows it; on iPhone, how to get it).
    if (canFull() || iosTip()) {
      $('btn-full').classList.remove('hidden');
      $('btn-full').innerHTML = G.Icons.html('full', 20);
      $('btn-full').onclick = toggleFull;
    }
  }

  function open(t) {
    if (t) tab = t;
    $('scr-settings').classList.remove('hidden');
    render();
  }
  function close() { $('scr-settings').classList.add('hidden'); }
  const isOpen = () => !$('scr-settings').classList.contains('hidden');

  // ---------------- pantalla completa ----------------
  function canFull() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  // iPhone: Safari no deja poner una web a pantalla completa (por eso a veces
  // no salía la opción). Sí se puede abriéndola desde la pantalla de inicio.
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => !!navigator.standalone || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  function iosTip() { return IOS && !canFull() && !standalone(); }
  const IOS_TIP = 'On iPhone, Safari does not let websites go fullscreen. Tap Share and then "Add to Home Screen": opening the game from that icon plays it fullscreen.';
  function toggleFull() {
    if (!canFull()) { if (iosTip()) G.UI.toast(IOS_TIP, 9000); return; }
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const el = document.documentElement;
      const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      // En móvil, además se intenta fijar la pantalla en horizontal.
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ } }).catch(() => {});
    }
    setTimeout(() => { if (isOpen()) render(); }, 300);
  }

  // ---------------- piezas ----------------
  function section(title, sub) { return `<h3 class="set-h">${esc(title)}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}`; }
  function toggle(key, label, desc) {
    const on = !!G.Settings.get(key);
    return `<div class="set-row"><div class="grow"><b>${esc(label)}</b><small>${esc(desc)}</small></div>
      <button class="btn small switch ${on ? 'gold' : ''}" data-k="${key}">${on ? 'On' : 'Off'}</button></div>`;
  }
  function choice(key, opts) {
    const cur = G.Settings.get(key);
    return `<div class="chips set-chips">${opts.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  }

  function render() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const box = $('set-body');
    box.scrollTop = 0;
    if (tab === 'sound') {
      box.innerHTML = section('Sound') + '<div id="set-sound" class="sound-inline"></div>';
      G.UI.soundControls($('set-sound'));
    } else if (tab === 'gfx') {
      const auto = ['low', 'medium', 'high'][G.Settings.autoLevel];
      box.innerHTML = section('Quality', 'How many effects and particles are drawn. <b>Auto</b> lowers it automatically if the game stutters (now: ' + auto + ').')
        + choice('quality', [['auto', 'Auto'], ['high', 'High'], ['mid', 'Medium'], ['low', 'Low']])
        + section('Display')
        + toggle('dmgNumbers', 'Damage numbers', 'The numbers that pop up when you hit or get hit.')
        + toggle('calm', 'Less shaking and flashing', 'The camera shakes less and flashes are softer.')
        + toggle('fps', 'Show FPS', 'Frames per second, in the bottom corner.')
        + (canFull() ? `<div class="set-row"><div class="grow"><b>Fullscreen</b><small>Without browser bars.</small></div>
             <button class="btn small" id="set-full">${isFull() ? 'Exit' : 'Turn on'}</button></div>`
           : iosTip() ? `<div class="set-row"><div class="grow"><b>Fullscreen</b><small>${esc(IOS_TIP)}</small></div></div>` : '');
    } else if (tab === 'ctl') {
      box.innerHTML = section('On mobile or tablet')
        + `<p class="sub">Put your finger anywhere and drag to move: the joystick appears where you touch. Tap a skill at the bottom to switch to it and the top-right button to pause. Play in landscape.</p>`
        + `<div class="set-row"><div class="grow"><b>Joystick size</b><small>How far you need to drag your finger.</small></div></div>`
        + choice('stick', [[0.8, 'Small'], [1, 'Normal'], [1.25, 'Large']])
        + section('On PC')
        + `<div class="keys">
             <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys</div><span>move</span>
             <div><kbd>1</kbd>–<kbd>4</kbd> or click its icon</div><span>choose skill</span>
             <div><kbd>Q</kbd> / <kbd>E</kbd></div><span>previous / next skill</span>
             <div><kbd>Esc</kbd> or <kbd>P</kbd></div><span>pause</span>
             <div><kbd>1</kbd>–<kbd>3</kbd></div><span>choose a card when leveling up</span>
           </div>`;
    } else if (tab === 'acc') {
      renderAccount(box);
    } else {
      box.innerHTML = `<div class="about-logo">Minecraft Survivor</div><p class="sub center">Version ${esc(VERSION)}</p>`
        + `<p class="sub">Unofficial fan game. Not affiliated with Mojang or Microsoft. Minecraft assets © Mojang.</p>`
        + section('Credits')
        + `<ul class="credits">
             <li><b>Textures and mobs:</b> Minecraft assets © Mojang (bedrock-samples).</li>
             <li><b>Music and sounds:</b> original, generated by the game itself.</li>
             <li><b>Font:</b> Pixelify Sans (OFL).</li>
             <li translate="no"><b>Engine:</b> PokéSurvivor (MIT).</li>
           </ul>`
        + `<div class="row wrap" style="justify-content:center;gap:8px">
             <button class="btn small" data-legal>Legal notice</button>
           </div>`;
    }
    wire(box);
  }

  function renderAccount(box) {
    const st = G.DB.guest ? 'guest' : G.DB.syncState;
    const SYNC = { ok: 'Saved', syncing: 'Saving…', pending: 'Saving…',
                   offline: 'Saved in this browser', local: 'Saved in this browser', guest: 'Guest: not saved' };
    if (G.DB.guest) {
      box.innerHTML = section('Account', 'You\'re playing as a <b>guest</b>: your progress isn\'t saved when you leave.')
        + `<button class="btn gold" id="set-login">Sign up or log in</button>`;
      return;
    }
    const nick = G.Social.me ? G.Social.me.name : (G.DB.user || '');
    const kind = G.DB.mode === 'local' ? 'This browser\'s account' : G.DB.nameAccount ? 'Name and password' : 'Google';
    box.innerHTML = section('Account')
      + `<div class="set-row"><div class="grow"><b>Name</b><small>It's unique and can't be changed.</small></div><span class="gold" translate="no">${esc(nick)}</span></div>`
      + `<div class="set-row"><div class="grow"><b>Account type</b></div><span>${esc(kind)}</span></div>`
      + `<div class="set-row"><div class="grow"><b>Save</b></div><span>${esc(SYNC[st] || st)}</span></div>`
      + (G.Dev && !G.Dev.allowed ? '' : `<div class="set-row"><div class="grow"><b>Dev mode</b><small>Cheat panel for testing: god mode, skills, bosses, dimensions, time of day, any mob. Opens with the DEV button or the \` key.</small></div>
           <button class="btn small switch ${G.Dev && G.Dev.enabled ? 'gold' : ''}" id="set-dev">${G.Dev && G.Dev.enabled ? 'On' : 'Off'}</button></div>`)
      + `<div class="row wrap" style="gap:8px;margin-top:12px">
           <button class="btn" id="set-logout">Log out</button>
           <button class="btn danger" id="set-delete">Delete account</button>
         </div><p class="note" id="set-msg"></p>`;
  }

  function wire(box) {
    box.querySelectorAll('.switch[data-k]').forEach(b => { b.onclick = () => { G.Settings.set(b.dataset.k, !G.Settings.get(b.dataset.k)); render(); }; });
    box.querySelectorAll('.chip[data-k]').forEach(b => {
      b.onclick = () => { const v = b.dataset.v; G.Settings.set(b.dataset.k, isNaN(+v) ? v : +v); render(); };
    });
    const full = $('set-full'); if (full) full.onclick = toggleFull;
    const dev = $('set-dev'); if (dev) dev.onclick = () => { G.Dev.setEnabled(!G.Dev.enabled); render(); };
    const lo = $('set-login'); if (lo) lo.onclick = () => { close(); leave(); };
    const out = $('set-logout'); if (out) out.onclick = () => { close(); leave(); };
    const del = $('set-delete');
    if (del) del.onclick = async () => {
      const ok = await G.UI.confirmDelete();
      if (!ok) return;
      del.disabled = true;
      const r = await G.DB.deleteAccount(ok.pass);
      if (!r.ok) { $('set-msg').textContent = r.error; del.disabled = false; return; }
      close();
      G.UI.toast('Account deleted');
      G.Audio.music(null);
      G.Flow.toLogin();
    };
  }

  /** Log out (quits the run if you are in one). */
  function leave() {
    if (G.DB.guest && !confirm('You\'re a guest: all your progress will be lost. Log out?')) return;
    if (G.Game.state !== 'ui') G.Game.quit && G.Game.quit();
    G.Audio.music(null);
    G.DB.logout().then(() => G.Flow.toLogin());
  }

  return { init, open, close, get isOpen() { return isOpen(); } };
})();
