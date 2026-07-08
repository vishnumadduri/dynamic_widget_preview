/** Small lookup of common Material/font_awesome icon names to a glyph, for approximate preview rendering. */
const ICONS: Record<string, string> = {
    favorite: '♥', favorite_border: '♡', home: '⌂', star: '★', star_border: '☆',
    search: '🔍', settings: '⚙', close: '✕', add: '+', remove: '−', check: '✓',
    arrow_back: '←', arrow_forward: '→', arrow_upward: '↑', arrow_downward: '↓',
    menu: '☰', more_vert: '⋮', more_horiz: '⋯', delete: '🗑', edit: '✎',
    share: '⤴', shopping_cart: '🛒', person: '👤', phone: '☎', email: '✉',
    location_on: '📍', calendar_today: '📅', camera_alt: '📷', notifications: '🔔',
    thumb_up: '👍', visibility: '👁', lock: '🔒', info: 'ℹ', warning: '⚠',
    'fa.google': 'G', 'fa.facebook': 'f', 'fa.twitter': 't',
    refresh: '⟳', water_drop: '💧', air: '🌬', thermostat: '🌡',
    cloud: '☁', wb_sunny: '☀', wb_cloudy: '☁', umbrella: '☂', ac_unit: '❄',
};

export function iconGlyph(data?: string): string {
    if (!data) { return '?'; }
    if (ICONS[data]) { return ICONS[data]; }
    const clean = data.replace(/^fa\./, '');
    const letters = clean.split(/[_\s]/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
    return letters || '?';
}
