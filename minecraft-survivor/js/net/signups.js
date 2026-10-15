/* ============ signups.js — new accounts are always open ============
 *
 * PokéSurvivor capped new accounts per month with a Cloudflare Worker and a
 * Firebase blocking function (the "portero"), because Firebase bills past
 * 50,000 monthly active users. Minecraft Survivor runs on the free Spark plan
 * with no Cloud Functions and no Worker, so sign-ups stay open and free:
 * nothing here contacts any server. The API stays so the login screen can ask.
 */
G.Signups = (() => {
  /** Can new accounts be created? Always. */
  async function check() { return true; }
  function report() {}
  function markNew() {}
  function nextMonthName() {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
    return d.toLocaleString('en-US', { month: 'long' });
  }
  return { check, report, markNew, nextMonthName, get closed() { return false; } };
})();
