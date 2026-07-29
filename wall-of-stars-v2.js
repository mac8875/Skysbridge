(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const config = window.SKYBRIDGE_CONFIG || {};
  const client = window.supabase?.createClient && config.supabaseUrl && config.supabaseAnonKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  const PAGE_SIZE = 20;
  let allMemorials = [];
  let visibleCount = PAGE_SIZE;

  const skyMemorial = {
    id: 'sky',
    child_name: 'Sky',
    remembrance: 'Sky is the first star on our Wall of Stars and the light behind Sky’s Bridge.',
    birth_date: null,
    passing_date: null,
    created_at: '2019-01-01T00:00:00Z',
    is_sky: true
  };

  const fallbackMemorials = [
    { id:'sample-s', child_name:'S', remembrance:'Forever loved and forever remembered.', birth_date:null, passing_date:null, created_at:'2026-07-20T00:00:00Z' },
    { id:'sample-ben', child_name:'Ben', remembrance:'A precious light held forever in loving hearts.', birth_date:null, passing_date:null, created_at:'2026-07-18T00:00:00Z' },
    { id:'sample-lily', child_name:'Lily', remembrance:'Her light continues to shine.', birth_date:null, passing_date:null, created_at:'2026-07-14T00:00:00Z' },
    { id:'sample-noah', child_name:'Noah', remembrance:'Always loved. Always remembered.', birth_date:null, passing_date:null, created_at:'2026-07-10T00:00:00Z' }
  ];

  function dateParts(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? { year:+match[1], month:+match[2], day:+match[3] } : null;
  }

  function isAnnualDateToday(value, now = new Date()) {
    const date = dateParts(value);
    return Boolean(date && date.month === now.getMonth() + 1 && date.day === now.getDate());
  }

  function dayState(item, now = new Date()) {
    // The remembrance day has priority if both dates happen to be identical.
    if (isAnnualDateToday(item.passing_date, now)) return 'remembrance';
    if (isAnnualDateToday(item.birth_date, now)) return 'birthday';
    return 'standard';
  }

  function formatDate(value) {
    const date = dateParts(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'long',year:'numeric'})
      .format(new Date(date.year,date.month-1,date.day));
  }

  function starSvg() {
    return `<svg class="star-symbol" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs><linearGradient id="cardStarGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8d7"/><stop offset=".46" stop-color="#ffd16d"/><stop offset="1" stop-color="#d89422"/></linearGradient></defs>
      <path d="M60 3 64.5 54.5 117 60 64.5 65.5 60 117 55.5 65.5 3 60 55.5 54.5Z"/>
    </svg>`;
  }

  function symbolMarkup(item) {
    const state = dayState(item);

    if (state === 'remembrance') {
      return `<span class="candle-glow" aria-hidden="true"></span><img class="candle-symbol" src="assets/memorial-candle.svg" alt="Memorial candle">`;
    }

    return starSvg();
  }

  function noteText(item) {
    const state = dayState(item);

    if (state === 'remembrance') return `Today we remember ${item.child_name}.`;
    if (state === 'birthday') return `Today we celebrate ${item.child_name}’s birthday.`;

    return '';
  }

  function createCard(item) {
    const state = dayState(item);
    const card = document.createElement('button');

    card.type = 'button';
    card.className = [
      'memorial-card',
      item.is_sky ? 'sky-card' : '',
      `is-${state}`
    ].filter(Boolean).join(' ');

    card.setAttribute(
      'aria-label',
      state === 'birthday'
        ? `Open memorial for ${item.child_name}, birthday today`
        : state === 'remembrance'
          ? `Open memorial for ${item.child_name}, remembrance day today`
          : `Open memorial for ${item.child_name}`
    );

    card.innerHTML = `
      ${state !== 'remembrance'
        ? '<span class="card-corner-star" aria-hidden="true">✦</span>'
        : ''}
      <h2 class="memorial-name"></h2>
      <span class="memorial-symbol">${symbolMarkup(item)}</span>
      <p class="day-note"></p>`;

    card.querySelector('.memorial-name').textContent = item.child_name || 'A cherished child';
    card.querySelector('.day-note').textContent = noteText(item);
    card.addEventListener('click', () => openDialog(item));

    return card;
  }

  function sortItems(items) {
    const mode = $('#starSort').value;

    return [...items].sort((a,b) => {
      if (a.is_sky) return -1;
      if (b.is_sky) return 1;
      if (mode === 'name') return (a.child_name || '').localeCompare(b.child_name || '');

      const diff = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return mode === 'oldest' ? diff : -diff;
    });
  }

  function filteredItems() {
    const search = $('#starSearch').value.trim().toLowerCase();
    const day = $('#dayFilter').value;

    return sortItems(allMemorials).filter(item => {
      const state = dayState(item);
      const matchesSearch = !search || (item.child_name || '').toLowerCase().includes(search);
      const matchesDay =
        day === 'all' ||
        (day === 'birthday' && state === 'birthday') ||
        (day === 'remembrance' && state === 'remembrance');

      return matchesSearch && matchesDay;
    });
  }

  function render() {
    const grid = $('#memorialGrid');
    const items = filteredItems();
    const shown = items.slice(0,visibleCount);

    grid.replaceChildren(...shown.map(createCard));
    $('#emptyMessage').classList.toggle('hidden', items.length !== 0);
    $('#loadMore').classList.toggle('hidden', shown.length >= items.length);

    const additional = Math.max(0,items.length - 1);
    $('#starCount').textContent = items.length
      ? (items[0]?.is_sky
          ? `Sky and ${additional} more ${additional === 1 ? 'light' : 'lights'}`
          : `${items.length} ${items.length === 1 ? 'light' : 'lights'}`)
      : 'No matching lights';
  }

  function openDialog(item) {
    const dialog = $('#memorialDialog');
    const state = dayState(item);

    $('#dialogName').textContent = item.child_name || 'A cherished child';
    $('#dialogStory').textContent = item.remembrance || 'Held forever in the hearts of those who love them.';

    const dates = [];
    if (item.birth_date) dates.push(`Born ${formatDate(item.birth_date)}`);
    if (item.passing_date) dates.push(`Remembered ${formatDate(item.passing_date)}`);

    $('#dialogDates').textContent = dates.join('  •  ');
    $('#dialogSymbol').textContent = state === 'remembrance' ? '🕯' : '✦';
    dialog.showModal();
  }

  async function loadMemorials() {
    let memorials = [];

    if (client) {
      const { data, error } = await client.from('memorials')
        .select('id,child_name,remembrance,birth_date,passing_date,created_at')
        .eq('approved',true)
        .eq('public_requested',true)
        .eq('archived',false)
        .order('created_at',{ascending:false})
        .limit(250);

      if (!error) memorials = data || [];
      else console.warn('Could not load memorials:',error.message);
    }

    allMemorials = [skyMemorial,...(memorials.length ? memorials : fallbackMemorials)];
    render();
  }

  $('.menu-button').addEventListener('click', event => {
    const button = event.currentTarget;
    const open = button.getAttribute('aria-expanded') === 'true';

    button.setAttribute('aria-expanded',String(!open));
    $('#mainNav').classList.toggle('open',!open);
  });

  $('#starSearch').addEventListener('input',() => {
    visibleCount = PAGE_SIZE;
    render();
  });

  $('#dayFilter').addEventListener('change',() => {
    visibleCount = PAGE_SIZE;
    render();
  });

  $('#starSort').addEventListener('change',() => {
    visibleCount = PAGE_SIZE;
    render();
  });

  $('#loadMore').addEventListener('click',() => {
    visibleCount += PAGE_SIZE;
    render();
  });

  $('.dialog-close').addEventListener('click',() => $('#memorialDialog').close());

  $('#memorialDialog').addEventListener('click',event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });

  $('#year').textContent = new Date().getFullYear();
  loadMemorials();
})();
