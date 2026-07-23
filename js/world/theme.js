// Restyle (2026-07-23 spec): pure theme logic — building→theme classes and the
// deterministic color helpers the themed overlays use. No DOM, Node-testable.
const WorldTheme = (() => {
  const THEMES = {
    estadio: 'theme-broadcast', imprensa: 'theme-press', casa: 'theme-casa',
    balneario: 'theme-locker', 'club-office': 'theme-dossier',
    boardroom: 'theme-dossier', agencia: 'theme-agency',
    sponsors: 'theme-vault', quadro: 'theme-lottery',
  };

  function _rgb(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return null;
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // Broadcast accent: the club primary when it reads on the dark matchday
  // background (#0a0e1a), electric lime otherwise (or on any invalid color).
  // WCAG-style contrast, not raw brightness — vivid reds must pass.
  function _lum(c) {
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  }
  const _BG_LUM = 0.00444; // #0a0e1a
  function accentFor(hex) {
    const c = _rgb(hex);
    if (!c) return '#ccff00';
    const contrast = (_lum(c) + 0.05) / (_BG_LUM + 0.05);
    return contrast < 2.5 ? '#ccff00' : hex;
  }

  function _hash(s) {
    let h = 0;
    for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  // Sponsor pitch cards: a stable brand identity per sponsor name.
  const BRANDS = [
    { bg: '#0a2a4a', fg: '#8adcff' }, { bg: '#241c0c', fg: '#e8b838' },
    { bg: '#1a0c24', fg: '#c890f0' }, { bg: '#0c241a', fg: '#68e0a8' },
    { bg: '#2a0c10', fg: '#f09090' }, { bg: '#101d2e', fg: '#88b0e8' },
  ];
  function brandColor(name) { return BRANDS[_hash(name) % BRANDS.length]; }

  // Lottery tickets: one color per board slot, cycling 10.
  const TICKETS = [
    { bg: '#f0c030', fg: '#7a5208' }, { bg: '#38a0e0', fg: '#0a3a5a' },
    { bg: '#a058c8', fg: '#f0e0ff' }, { bg: '#e05858', fg: '#5a0a0a' },
    { bg: '#48b878', fg: '#0a3a20' }, { bg: '#e88838', fg: '#5a2a08' },
    { bg: '#5878e0', fg: '#0a1a5a' }, { bg: '#d858a8', fg: '#5a0a3a' },
    { bg: '#58c8c8', fg: '#0a3a3a' }, { bg: '#b8c848', fg: '#3a400a' },
  ];
  function ticketColor(i) { return TICKETS[((i % 10) + 10) % 10]; }

  // Feed avatars: two gradient stops per handle.
  const AVATARS = [
    { a: '#1d9bf0', b: '#0a5a94' }, { a: '#c85a9a', b: '#8a3266' },
    { a: '#5ac878', b: '#2a8a4e' }, { a: '#c8845a', b: '#8a5432' },
    { a: '#8a5cf6', b: '#4a2c94' }, { a: '#e0a848', b: '#94641a' },
  ];
  function avatarColors(handle) { return AVATARS[_hash(handle) % AVATARS.length]; }

  const api = { THEMES, accentFor, brandColor, ticketColor, avatarColors };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
