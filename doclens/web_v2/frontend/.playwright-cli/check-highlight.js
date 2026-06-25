async (page) => {
  const result = await page.evaluate(() => {
    const pp = document.querySelector('preview-pane');
    const mdv = pp && pp.shadowRoot && pp.shadowRoot.querySelector('md-viewer');
    const root = mdv && mdv.shadowRoot;
    if (!root) return 'no-mdv';
    const flashed = root.querySelector('.highlight-flash');
    const sample = Array.from(root.querySelectorAll('[data-source-line]'))
      .slice(0, 10)
      .map(el => ({
        tag: el.tagName,
        line: el.getAttribute('data-source-line'),
        flashed: el.classList.contains('highlight-flash'),
      }));
    return JSON.stringify({
      flashed: flashed ? { tag: flashed.tagName, line: flashed.getAttribute('data-source-line') } : null,
      sample,
    }, null, 2);
  });
  console.log(result);
}
