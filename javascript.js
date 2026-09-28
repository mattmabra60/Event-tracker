const sections = document.querySelectorAll('.page-section');
const navItems = document.querySelectorAll('[data-page]');
const pageLinks = document.querySelectorAll('[data-page-link]');

function showPage(page) {
  sections.forEach(section => {
    section.classList.toggle('active-page', section.dataset.section === page);
  });

  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navItems.forEach(item => {
  item.addEventListener('click', () => showPage(item.dataset.page));
});

pageLinks.forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    showPage(link.dataset.pageLink);
  });
});

document.querySelectorAll('.save-button').forEach(button => {
  button.addEventListener('click', () => {
    button.classList.toggle('saved-active');
    button.textContent = button.classList.contains('saved-active') ? '♥' : '♡';
  });
});

document.querySelectorAll('.map-pin').forEach(pin => {
  pin.addEventListener('click', () => {
    document.querySelectorAll('.map-pin').forEach(item => {
      item.classList.remove('active');
    });

    pin.classList.add('active');
    document.querySelector('#map-title').textContent = pin.dataset.mapTitle;
    document.querySelector('#map-place').textContent = pin.dataset.mapPlace;
  });
});

document.querySelector('#event-search').addEventListener('input', event => {
  const query = event.target.value.toLowerCase();

  document.querySelectorAll('.search-result').forEach(result => {
    result.hidden = !result.dataset.search.includes(query);
  });
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(item => {
      item.classList.remove('active');
    });

    chip.classList.add('active');
  });
});