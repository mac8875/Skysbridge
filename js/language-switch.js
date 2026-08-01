(() => {
  document.querySelectorAll('[data-language-link]').forEach(link => {
    link.addEventListener('click', event => {
      const target = new URL(link.getAttribute('href'), window.location.href);
      const isHomePair = /index(?:-de)?\.html$/.test(target.pathname) || target.pathname.endsWith('/');
      if (isHomePair && window.location.hash) target.hash = window.location.hash;
      try { localStorage.setItem('skysbridge-language', link.dataset.languageLink || 'en'); } catch (_) {}
      event.preventDefault();
      window.location.assign(target.href);
    });
  });
})();
