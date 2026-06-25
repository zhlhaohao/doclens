async (page) => {
  await page.locator('result-card').first().click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: '.playwright-cli/just-clicked.png', scale: 'css', type: 'png' });
  const result = await page.evaluate(() => {
    const pp = document.querySelector('preview-pane');
    const mdv = pp && pp.shadowRoot && pp.shadowRoot.querySelector('md-viewer');
    const root = mdv && mdv.shadowRoot;
    if (!root) return 'NO_MDV';
    const flashed = root.querySelector('.highlight-flash');
    return JSON.stringify({
      hasFlashed: !!flashed,
      tag: flashed ? flashed.tagName : null,
      line: flashed ? flashed.getAttribute('data-source-line') : null,
    });
  });
  await page.evaluate((r) => { window.__probe = r; }, result);
  return result;
}
