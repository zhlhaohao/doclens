async (page) => {
  return await page.evaluate(() => {
    const ca = document.querySelector('cortex-app');
    const sv = ca && ca.shadowRoot && ca.shadowRoot.querySelector('search-view');
    if (!sv || !sv.shadowRoot) return 'NO_SV';
    const pp = sv.shadowRoot.querySelector('preview-pane');
    if (!pp) return 'NO_PP';
    const ppRoot = pp.shadowRoot;
    const mdv = ppRoot && ppRoot.querySelector('md-viewer');
    const mdvRoot = mdv && mdv.shadowRoot;
    const flashed = mdvRoot && mdvRoot.querySelector('.highlight-flash');
    const allMarked = mdvRoot ? Array.from(mdvRoot.querySelectorAll('[data-source-line]')) : [];
    return {
      hasPreviewPane: true,
      hasMdViewer: !!mdv,
      mdvLine: mdv ? mdv.line : null,
      mdvContentLen: mdv ? (mdv.content || '').length : 0,
      hasFlashed: !!flashed,
      flashedTag: flashed ? flashed.tagName : null,
      flashedLine: flashed ? flashed.getAttribute('data-source-line') : null,
      totalMarkedBlocks: allMarked.length,
      firstMarked: allMarked.slice(0, 5).map(el => el.tagName + '@L' + el.getAttribute('data-source-line')),
    };
  });
}
