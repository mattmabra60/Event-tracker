const SUPABASE_URL = 'https://jvaximbcbfeiwlnhhiqe.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_drMmHtQl9t0CWPRim39aAQ_Ply9BZBQ';
const pageName = document.body.dataset.page;
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

let currentUser = null;
let currentProfile = null;
let events = [];
let savedEventIds = new Set();
let attendanceEventIds = new Set();
let currentLocation = { name: 'Rexburg, ID', latitude: 43.8231, longitude: -111.7924 };
let mapInstance = null;
let mapMarkers = [];

const fallbackEvents = [
  { id: 'fallback-rooftop', title: 'Rexburg Rooftop Sessions', description: 'Live music and good people.', category: 'MUSIC', venue: 'The Cove', address: '220 S 2nd W', city: 'Rexburg', state: 'ID', starts_at: '2026-10-23T20:00:00-06:00', price: 0, image_theme: 'sunset' },
  { id: 'fallback-hike', title: 'Table Rock Campground Sunset Hike', description: 'A sunset hike near Rexburg.', category: 'OUTDOORS', venue: 'Table Rock campground', address: 'Forest Road 217', city: 'Ririe', state: 'ID', starts_at: '2026-10-24T18:00:00-06:00', price: 0, image_theme: 'green' },
  { id: 'fallback-taco', title: 'Downtown Taco Walk', description: 'A walk through local taco spots.', category: 'FOOD', venue: 'Downtown Rexburg', address: 'E Main St', city: 'Rexburg', state: 'ID', starts_at: '2026-10-24T12:00:00-06:00', price: 0, image_theme: 'orange' },
  { id: 'fallback-market', title: 'Rexburg Farmers Market', description: 'Local food and vendors.', category: 'MARKET', venue: 'Porter Park', address: 'S 2nd W & 3rd W', city: 'Rexburg', state: 'ID', starts_at: '2026-10-24T09:00:00-06:00', price: 0, image_theme: 'yellow' },
  { id: 'fallback-comedy', title: 'Laughs at The Atrium', description: 'A night of stand-up comedy.', category: 'NIGHTLIFE', venue: 'The Atrium', address: '160 W 2nd S #207', city: 'Rexburg', state: 'ID', starts_at: '2026-10-23T21:30:00-06:00', price: 10, image_theme: 'purple' },
  { id: 'fallback-cleanup', title: 'Park Cleanup Crew', description: 'Volunteer with the local cleanup crew.', category: 'COMMUNITY', venue: 'Smith Park', address: 'E Main St', city: 'Rexburg', state: 'ID', starts_at: '2026-10-24T10:00:00-06:00', price: 0, image_theme: 'blue' },
  { id: 'fallback-open-mic', title: 'Open Mic Night at The School', description: 'Support local performers.', category: 'COMMUNITY', venue: 'The School', address: '525 S Center St', city: 'Rexburg', state: 'ID', starts_at: '2026-10-29T19:00:00-06:00', price: 0, image_theme: 'purple' }
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatEventDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatCompactDate(value) {
  const date = new Date(value);
  return { day: date.getDate(), month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() };
}

function eventLocation(event) {
  return [event.venue, event.address, event.city, event.state].filter(Boolean).join(` ${String.fromCharCode(183)} `);
}

function eventSearchText(event) {
  return [event.title, event.description, event.category, event.venue, event.address, event.city].join(' ').toLowerCase();
}

function themeClass(event) {
  return String(event.image_theme || 'sunset').toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function eventCard(event, featured = false) {
  const saved = savedEventIds.has(String(event.id));
  const going = attendanceEventIds.has(String(event.id));
  return `<article class="event-card${featured ? ' featured' : ''}" data-event-id="${escapeHtml(event.id)}">
    <div class="event-image ${themeClass(event)}">
      <span class="category">${escapeHtml(event.category)}</span>
      <button class="save-button ${saved ? 'saved-active' : ''}" data-event-id="${escapeHtml(event.id)}" aria-label="${saved ? 'Remove saved event' : 'Save event'}">${saved ? '\u2665' : '\u2661'}</button>
      <div class="image-title">${escapeHtml(event.category.toLowerCase())}<br /><strong>${escapeHtml(event.title.split(' ').slice(-1).join(' '))}</strong></div>
    </div>
    <div class="event-body">
      <div class="event-meta"><span>${escapeHtml(formatEventDate(event.starts_at))}</span><span class="distance">Rexburg</span></div>
      <h3>${escapeHtml(event.title)}</h3>
      <p>${escapeHtml(eventLocation(event))}</p>
      <small>${escapeHtml(event.description || 'Make tonight worth remembering.')}</small>
      <button class="going-button ${going ? 'going-active' : ''}" data-attendance-id="${escapeHtml(event.id)}">${going ? 'Going' : "I'm going"}</button>
    </div>
  </article>`;
}

function searchResult(event) {
  const saved = savedEventIds.has(String(event.id));
  return `<div class="search-result" data-search="${escapeHtml(eventSearchText(event))}" data-event-id="${escapeHtml(event.id)}">
    <div class="result-icon ${themeClass(event)}">${event.category === 'MARKET' ? '\u273f' : event.category === 'NIGHTLIFE' ? '\u263b' : '\u2726'}</div>
    <div><span class="compact-type">${escapeHtml(event.category)} · ${escapeHtml(formatEventDate(event.starts_at))}</span><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(eventLocation(event))}</p></div>
    <button class="save-button plain ${saved ? 'saved-active' : ''}" data-event-id="${escapeHtml(event.id)}" aria-label="${saved ? 'Remove saved event' : 'Save event'}">${saved ? '\u2665' : '\u2661'}</button>
  </div>`;
}

function weatherDescription(code) {
  if (code === 0) return { label: 'Clear sky', icon: '☀' };
  if ([1, 2].includes(code)) return { label: 'Partly cloudy', icon: '◐' };
  if (code === 3) return { label: 'Overcast', icon: '☁' };
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: '≋' };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', icon: '☂' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', icon: '☂' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: '❄' };
  if ([95, 96, 99].includes(code)) return { label: 'Storms', icon: 'ϟ' };
  return { label: 'Current conditions', icon: '☀' };
}

async function loadWeather() {
  const city = currentProfile?.city || 'Rexburg';
  const state = currentProfile?.state || 'ID';
  try {
    const locationResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(`${city}, ${state}`)}&count=1&language=en&format=json`);
    const locationData = await locationResponse.json();
    const location = locationData.results?.[0];
    if (!location) throw new Error('Location not found');
    currentLocation = { name: `${location.name}, ${location.admin1 || state}`, latitude: location.latitude, longitude: location.longitude };

    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`);
    const weatherData = await weatherResponse.json();
    const condition = weatherDescription(weatherData.current?.weather_code);
    document.querySelectorAll('[data-weather-temp]').forEach(element => { element.textContent = `${Math.round(weatherData.current?.temperature_2m ?? 0)}°`; });
    document.querySelectorAll('[data-weather-location]').forEach(element => { element.textContent = currentLocation.name; });
    document.querySelectorAll('[data-weather-icon]').forEach(element => { element.textContent = condition.icon; element.title = condition.label; });
  } catch (error) {
    document.querySelectorAll('[data-weather-location]').forEach(element => { element.textContent = currentLocation.name; });
    console.warn('Weather unavailable:', error.message);
  }
}

async function loadEvents() {
  if (!supabaseClient) return fallbackEvents;
  const { data, error } = await supabaseClient.from('events').select('*').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true });
  if (error || !data?.length) {
    if (error) console.warn('Events unavailable; showing local fallback data.', error.message);
    return fallbackEvents;
  }
  return data;
}

async function loadUserData() {
  if (!supabaseClient) return;
  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;
  if (!currentUser) return;

  const [profileResult, savedResult, attendanceResult] = await Promise.all([
    supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
    supabaseClient.from('saved_events').select('event_id').eq('user_id', currentUser.id),
    supabaseClient.from('event_attendance').select('event_id').eq('user_id', currentUser.id)
  ]);
  currentProfile = profileResult.data;
  await ensureProfile();
  savedEventIds = new Set((savedResult.data || []).map(row => String(row.event_id)));
  attendanceEventIds = new Set((attendanceResult.data || []).map(row => String(row.event_id)));
}

function initialsFor(name = 'WT') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'WT';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function firstNameForDisplay(name = 'WTM member') {
  return name.trim().split(/\s+/).filter(Boolean)[0] || 'WTM member';
}

function handleFor(name = 'wtm_member') {
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
  return handle || 'wtm_member';
}

async function ensureProfile() {
  if (!currentUser || !supabaseClient) return;
  const metadataName = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'WTM member';
  if (!currentProfile) {
    const { data, error } = await supabaseClient.from('profiles').upsert({ id: currentUser.id, display_name: metadataName, username: `${handleFor(metadataName)}_${currentUser.id.slice(0, 4)}` }, { onConflict: 'id' }).select().single();
    if (!error) currentProfile = data;
    return;
  }
  const updates = {};
  if (!currentProfile.display_name) updates.display_name = metadataName;
  if (!currentProfile.username) updates.username = `${handleFor(currentProfile.display_name || metadataName)}_${currentUser.id.slice(0, 4)}`;
  if (!Object.keys(updates).length) return;
  const { data, error } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id).select().single();
  if (!error) currentProfile = data;
}

function updateProfileChrome() {
  const fullName = currentProfile?.display_name || currentUser?.user_metadata?.display_name || 'Sign in to WTM';
  const displayName = currentUser ? firstNameForDisplay(fullName) : fullName;
  const handle = currentProfile?.username ? `@${currentProfile.username}` : '@your_handle';
  const initials = initialsFor(fullName);
  const city = currentProfile?.city || 'Rexburg';
  const state = currentProfile?.state || 'ID';
  document.querySelectorAll('[data-profile-name]').forEach(element => { element.textContent = displayName; });
  document.querySelectorAll('[data-profile-handle]').forEach(element => { element.textContent = handle; });
  document.querySelectorAll('[data-location-label]').forEach(element => { element.textContent = `${city}, ${state}`.toUpperCase(); });
  const heroCity = document.querySelector('#hero-city');
  if (heroCity) heroCity.textContent = city;
  document.querySelectorAll('[data-profile-avatar]').forEach(element => {
    const avatarUrl = currentProfile?.avatar_url;
    element.textContent = avatarUrl ? '' : initials;
    element.style.backgroundImage = avatarUrl ? `url("${avatarUrl.replace(/"/g, '')}")` : '';
    element.style.backgroundSize = avatarUrl ? 'cover' : '';
    element.style.backgroundPosition = avatarUrl ? 'center' : '';
  });
}

function updateNavigation() {
  document.querySelectorAll('[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === pageName));
  const count = document.querySelector('.count');
  if (count) count.textContent = String(savedEventIds.size || 0);

  updateProfileChrome();
  const bottom = document.querySelector('.sidebar-bottom');
  if (!bottom) return;
  const existing = bottom.querySelector('.account-actions');
  if (currentUser) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.innerHTML = '<a class="account-primary" href="login.html">Sign in</a>';
    return;
  }
  const action = document.createElement('div');
  action.className = 'account-actions';
  action.innerHTML = '<a class="account-primary" href="login.html">Sign in</a>';
  bottom.appendChild(action);
}

function renderFeed() {
  const heroTime = document.querySelector('#hero-time');
  if (heroTime) {
    if (events.length) heroTime.textContent = `NEXT UP · ${formatEventDate(events[0].starts_at).toUpperCase()}`;
    else heroTime.remove();
  }
  const grid = document.querySelector('#event-grid');
  if (grid) grid.innerHTML = events.slice(0, 3).map((event, index) => eventCard(event, index === 0)).join('');
  const compact = document.querySelector('#compact-events');
  if (compact) {
    const event = events[6] || events[events.length - 1];
    const date = formatCompactDate(event.starts_at);
    compact.innerHTML = `<div class="compact-date"><strong>${date.day}</strong><span>${date.month}<br />${date.weekday}</span></div><div><span class="compact-type">${escapeHtml(event.category)}</span><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(formatEventDate(event.starts_at))} · ${escapeHtml(eventLocation(event))}</p></div><a class="compact-arrow" href="search.html" aria-label="View all events">→</a>`;
  }
}

function renderSearch() {
  const list = document.querySelector('#search-list');
  if (list) list.innerHTML = events.map(searchResult).join('');
  const count = document.querySelector('#search-count');
  if (count) count.textContent = `${events.length} events`;
}

async function renderSaved() {
  const list = document.querySelector('#saved-list');
  if (!list) return;
  if (!currentUser) {
    list.innerHTML = '<div class="empty-state">Sign in to keep your favorite events in one place.<br /><a href="login.html">Go to sign in →</a></div>';
    return;
  }
  const saved = events.filter(event => savedEventIds.has(String(event.id)));
  list.innerHTML = saved.length ? saved.map(event => `<div class="saved-row"><div class="date-tile"><strong>${formatCompactDate(event.starts_at).day}</strong><span>${formatCompactDate(event.starts_at).month}</span></div><div><span class="compact-type">${escapeHtml(event.category)} · ${escapeHtml(formatEventDate(event.starts_at))}</span><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(eventLocation(event))}</p></div><button class="save-button saved-active" data-event-id="${escapeHtml(event.id)}">♥</button></div>`).join('') : '<div class="empty-state">Nothing saved yet. Explore the map and find your next move.</div>';
}

function renderProfile() {
  const name = document.querySelector('#profile-name');
  const location = document.querySelector('#profile-location');
  const savedCount = document.querySelector('#profile-saved-count');
  const signOut = document.querySelector('.profile-signout');
  if (signOut) signOut.hidden = !currentUser;
  if (!name) return;
  if (!currentUser) {
    name.textContent = 'Your profile';
    location.textContent = 'Sign in to personalize your profile';
    if (savedCount) savedCount.textContent = '0';
    return;
  }
  const fullName = currentProfile?.display_name || currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'WTM member';
  name.textContent = firstNameForDisplay(fullName);
  location.textContent = `${currentProfile?.username ? `@${currentProfile.username} · ` : ''}${currentProfile?.city || 'Rexburg'}, ${currentProfile?.state || 'ID'}`;
  if (savedCount) savedCount.textContent = String(savedEventIds.size);
}

function openProfileEditor() {
  const modal = document.querySelector('#profile-modal');
  const form = document.querySelector('#profile-form');
  if (!modal || !form || !currentUser) {
    if (!currentUser) window.location.href = 'login.html?returnTo=profile.html';
    return;
  }
  form.elements.display_name.value = currentProfile?.display_name || currentUser.user_metadata?.display_name || '';
  form.elements.username.value = currentProfile?.username || '';
  form.elements.avatar_url.value = currentProfile?.avatar_url || '';
  form.elements.city.value = currentProfile?.city || 'Rexburg';
  form.elements.state.value = currentProfile?.state || 'ID';
  form.querySelector('.profile-form-message').textContent = '';
  modal.hidden = false;
  form.elements.display_name.focus();
}

function closeProfileEditor() {
  const modal = document.querySelector('#profile-modal');
  if (modal) modal.hidden = true;
}

async function saveProfile(form) {
  const message = form.querySelector('.profile-form-message');
  const username = form.elements.username.value.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_|_$/g, '').slice(0, 30);
  const updates = {
    display_name: form.elements.display_name.value.trim(),
    username: username || handleFor(form.elements.display_name.value),
    avatar_url: form.elements.avatar_url.value.trim() || null,
    city: form.elements.city.value.trim() || 'Rexburg',
    state: form.elements.state.value.trim().toUpperCase() || 'ID'
  };
  message.textContent = 'Saving...';
  const { data, error } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id).select().single();
  if (error) {
    message.textContent = error.code === '23505' ? 'That handle is already taken.' : error.message;
    return;
  }
  currentProfile = data;
  updateProfileChrome();
  updateNavigation();
  await loadWeather();
  renderProfile();
  renderMap();
  closeProfileEditor();
}

function renderMap() {
  const mapElement = document.querySelector('#leaflet-map');
  if (!mapElement || !window.L) return;
  if (mapInstance) mapInstance.remove();
  mapInstance = window.L.map(mapElement).setView([currentLocation.latitude, currentLocation.longitude], 12);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mapInstance);
  mapMarkers = [];
  const firstEvent = events[0];
  if (firstEvent) {
    const title = document.querySelector('#map-title');
    const place = document.querySelector('#map-place');
    if (title) title.textContent = firstEvent.title;
    if (place) place.textContent = `${firstEvent.venue || firstEvent.city} · ${formatEventDate(firstEvent.starts_at)}`;
  }

  events.forEach((event, index) => {
    const latitude = Number(event.latitude) || currentLocation.latitude + ((index % 3) - 1) * 0.006;
    const longitude = Number(event.longitude) || currentLocation.longitude + ((index % 2) - 0.5) * 0.008;
    const marker = window.L.marker([latitude, longitude]).addTo(mapInstance);
    marker.bindPopup(`<strong>${escapeHtml(event.title)}</strong><br />${escapeHtml(event.venue || event.city)}<br /><button class="map-popup-action" data-event-id="${escapeHtml(event.id)}">View event</button>`);
    marker.on('click', () => {
      const title = document.querySelector('#map-title');
      const place = document.querySelector('#map-place');
      if (title) title.textContent = event.title;
      if (place) place.textContent = `${event.venue || event.city} · ${formatEventDate(event.starts_at)}`;
    });
    mapMarkers.push(marker);
  });

  const locateButton = document.querySelector('#locate-me');
  if (locateButton) locateButton.onclick = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(position => {
      const center = [position.coords.latitude, position.coords.longitude];
      mapInstance.setView(center, 14);
      window.L.circleMarker(center, { radius: 8, color: '#6f54ff', fillColor: '#d8f36a', fillOpacity: 1 }).addTo(mapInstance).bindPopup('You are here').openPopup();
    });
  };
}

let activeSearchFilter = 'all';
let activeSearchQuery = '';

function applySearchFilters() {
  const now = new Date();
  const results = document.querySelectorAll('.search-result');
  let visibleCount = 0;
  results.forEach(result => {
    const event = events.find(item => String(item.id) === result.dataset.eventId);
    const matchesQuery = !activeSearchQuery || result.dataset.search.includes(activeSearchQuery);
    const eventDate = event ? new Date(event.starts_at) : now;
    const day = eventDate.getDay();
    const matchesFilter = activeSearchFilter === 'all'
      || (activeSearchFilter === 'tonight' && eventDate.toDateString() === now.toDateString())
      || (activeSearchFilter === 'weekend' && (day === 5 || day === 6))
      || (activeSearchFilter === 'free' && Number(event?.price || 0) === 0);
    result.hidden = !(matchesQuery && matchesFilter);
    if (!result.hidden) visibleCount += 1;
  });
  const count = document.querySelector('#search-count');
  if (count) count.textContent = `${visibleCount} ${visibleCount === 1 ? 'event' : 'events'}`;
}

function toggleMobileMenu() {
  const header = document.querySelector('.mobile-header');
  if (!header) return;
  let menu = header.querySelector('.mobile-menu');
  if (!menu) {
    menu = document.createElement('nav');
    menu.className = 'mobile-menu';
    menu.innerHTML = `<a data-page="feed" href="index.html">For you</a><a data-page="search" href="search.html">Search events</a><a data-page="map" href="map.html">Map view</a><a data-page="saved" href="saved.html">Saved events</a><a data-page="profile" href="profile.html">Profile</a>`;
    menu.querySelectorAll('[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === pageName));
    header.appendChild(menu);
  }
  menu.classList.toggle('is-open');
}

async function toggleSaved(button) {
  const eventId = button.dataset.eventId;
  if (!currentUser || !supabaseClient || String(eventId).startsWith('fallback-')) {
    if (!currentUser) window.location.href = `login.html?returnTo=${encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html')}`;
    return;
  }
  const isSaved = savedEventIds.has(eventId);
  const request = isSaved
    ? supabaseClient.from('saved_events').delete().eq('user_id', currentUser.id).eq('event_id', eventId)
    : supabaseClient.from('saved_events').insert({ user_id: currentUser.id, event_id: eventId });
  const { error } = await request;
  if (error) return console.error('Unable to update saved event:', error.message);
  isSaved ? savedEventIds.delete(eventId) : savedEventIds.add(eventId);
  renderFeed(); renderSearch(); renderSaved(); updateNavigation();
}

async function toggleAttendance(button) {
  const eventId = button.dataset.attendanceId;
  if (!currentUser || !supabaseClient || String(eventId).startsWith('fallback-')) {
    if (!currentUser) window.location.href = `login.html?returnTo=${encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html')}`;
    return;
  }
  const isGoing = attendanceEventIds.has(eventId);
  const request = isGoing
    ? supabaseClient.from('event_attendance').delete().eq('user_id', currentUser.id).eq('event_id', eventId)
    : supabaseClient.from('event_attendance').insert({ user_id: currentUser.id, event_id: eventId });
  const { error } = await request;
  if (error) return console.error('Unable to update attendance:', error.message);
  isGoing ? attendanceEventIds.delete(eventId) : attendanceEventIds.add(eventId);
  renderFeed();
}

function wireInteractions() {
  document.addEventListener('click', event => {
    const saveButton = event.target.closest('.save-button[data-event-id]');
    if (saveButton) { event.preventDefault(); toggleSaved(saveButton); return; }
    const goingButton = event.target.closest('.going-button[data-attendance-id]');
    if (goingButton) { event.preventDefault(); toggleAttendance(goingButton); return; }
    const signOut = event.target.closest('[data-sign-out]');
    if (signOut && supabaseClient) supabaseClient.auth.signOut().then(() => window.location.href = 'index.html');
    if (event.target.closest('.icon-button')) { toggleMobileMenu(); return; }
    if (event.target.closest('[data-edit-profile]')) { event.preventDefault(); openProfileEditor(); return; }
    if (event.target.closest('[data-close-profile]')) { event.preventDefault(); closeProfileEditor(); return; }
    if (event.target.closest('.map-popup-action')) { window.location.href = 'search.html'; return; }
    const pin = event.target.closest('.map-pin');
    if (pin) {
      document.querySelectorAll('.map-pin').forEach(item => item.classList.remove('active'));
      pin.classList.add('active');
      document.querySelector('#map-title')?.replaceChildren(document.createTextNode(pin.dataset.mapTitle));
      document.querySelector('#map-place')?.replaceChildren(document.createTextNode(pin.dataset.mapPlace));
    }
  });

  const searchInput = document.querySelector('#event-search');
  searchInput?.addEventListener('input', event => {
    activeSearchQuery = event.target.value.trim().toLowerCase();
    applySearchFilters();
  });
  document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(item => item.classList.remove('active'));
    chip.classList.add('active');
    const filter = chip.textContent.trim().toLowerCase();
    activeSearchFilter = filter === 'tonight' ? 'tonight' : filter === 'this weekend' ? 'weekend' : filter === 'free' ? 'free' : 'all';
    applySearchFilters();
  }));

  document.querySelector('#profile-form')?.addEventListener('submit', event => {
    event.preventDefault();
    saveProfile(event.currentTarget);
  });
}

async function initApp() {
  await loadUserData();
  events = await loadEvents();
  await loadWeather();
  updateNavigation();
  renderFeed(); renderSearch(); await renderSaved(); renderProfile(); renderMap();
  wireInteractions();
}

async function initAuth() {
  const form = document.querySelector('#auth-form');
  if (!form || !supabaseClient) return;
  let signUpMode = false;
  const title = document.querySelector('#auth-title');
  const submit = form.querySelector('.auth-submit');
  const switchButton = document.querySelector('.auth-switch');
  const nameField = document.querySelector('#auth-name-field');
  const message = document.querySelector('.auth-message');
  switchButton?.addEventListener('click', () => {
    signUpMode = !signUpMode;
    title.textContent = signUpMode ? 'Create your account' : 'Welcome back';
    submit.textContent = signUpMode ? 'Create account' : 'Sign in';
    switchButton.textContent = signUpMode ? 'Already have an account? Sign in' : 'New here? Create an account';
    nameField.hidden = !signUpMode;
    message.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); message.textContent = 'Working...';
    const email = form.elements.email.value.trim(); const password = form.elements.password.value;
    const result = signUpMode
      ? await supabaseClient.auth.signUp({ email, password, options: { data: { display_name: form.elements.name.value.trim() } } })
      : await supabaseClient.auth.signInWithPassword({ email, password });
    if (result.error) { message.textContent = result.error.message; return; }
    if (signUpMode && !result.data.session) { message.textContent = 'Check your email to confirm your account, then come back to sign in.'; return; }
    const returnTo = new URLSearchParams(window.location.search).get('returnTo') || 'index.html';
    window.location.href = returnTo;
  });
}

initAuth();
if (pageName !== 'auth') initApp();
