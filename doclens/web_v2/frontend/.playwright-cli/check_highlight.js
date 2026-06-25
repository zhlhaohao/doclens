() => {
  const pp = document.querySelector('preview-pane');
  if (!pp || !pp.shadowRoot) return 'no preview-pane';
  const mdv = pp.shadowRoot.querySelector('md-viewer');
  if (!mdv || !mdv.shadowRoot) return 'no md-viewer';
  const root = mdv.shadowRoot;
  const flashed = root.querySelector('.highlight-flash');
  const allMarked = Array.from(root.querySelectorAll('[data-source-line]')).slice(0, 5).map(el => ({
    tag: el.tagName,
    line: el.getAttribute('data-source-line'),
    flashed: el.classList.contains('highlight-flash'),
  }));
  return JSON.stringify({
    flashed: flashed ? { tag: flashed.tagName, line: flashed.getAttribute('data-source-line') } : null,
    sample: allMarked,
  }, null, 2);
}
