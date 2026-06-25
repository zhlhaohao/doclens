async (page) => {
  await page.locator('result-card').first().click();
  await page.waitForTimeout(500);
  return await page.evaluate(() => {
    const pp = document.querySelector('preview-pane');
    const mdv = pp && pp.shadowRoot && pp.shadowRoot.querySelector('md-viewer');
    const root = mdv && mdv.shadowRoot;
    if (!root) return 'NO_MDV';
    const flashed = root.querySelector('.highlight-flash');
    return {
      hasMdViewer: !!mdv,
      hasFlashed: !!flashed,
      flashedTag: flashed ? flashed.tagName : null,
      flashedLine: flashed ? flashed.getAttribute('data-source-line') : null,
      sampleLines: Array.from(root.querySelectorAll('[data-source-line]')).slice(0, 5).map((el) => el.getAttribute('data-source-line')),
    };
  });
}
