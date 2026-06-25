function checkHighlightState() {
  const pp = document.querySelector('preview-pane');
  const mdv = pp && pp.shadowRoot && pp.shadowRoot.querySelector('md-viewer');
  const root = mdv && mdv.shadowRoot;
  if (!root) return 'no-mdv';
  const flashed = root.querySelector('.highlight-flash');
  const sample = Array.from(root.querySelectorAll('[data-source-line]'))
    .slice(0, 10)
    .map(function(el) {
      return el.tagName + '@L' + el.getAttribute('data-source-line') +
        (el.classList.contains('highlight-flash') ? '+FLASH' : '');
    });
  return JSON.stringify({
    flashed: flashed ? flashed.tagName + '@L' + flashed.getAttribute('data-source-line') : null,
    sample: sample,
  });
}
