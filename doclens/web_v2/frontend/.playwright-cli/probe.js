async (page) => {
  // Re-click the first card to trigger fresh highlight, then immediately probe
  await page.locator('result-card').first().click();
  await page.waitForTimeout(200);
  const result = await page.evaluate(() => {
    const pp = document.querySelector('preview-pane');
    const mdv = pp && pp.shadowRoot && pp.shadowRoot.querySelector('md-viewer');
    const root = mdv && mdv.shadowRoot;
    if (!root) return 'NO_MDV';
    const flashed = root.querySelector('.highlight-flash');
    const sample = Array.from(root.querySelectorAll('[data-source-line]'))
      .slice(0, 10)
      .map((el) => `${el.tagName}@L${el.getAttribute('data-source-line')}${el.classList.contains('highlight-flash') ? '+F' : ''}`);
    return {
      flashed: flashed ? `${flashed.tagName}@L${flashed.getAttribute('data-source-line')}` : null,
      sample,
    };
  });
  return JSON.stringify(result);
}
