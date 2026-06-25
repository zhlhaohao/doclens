async (page) => {
  return await page.evaluate(() => {
    const ca = document.querySelector('cortex-app');
    const sv = ca && ca.shadowRoot && ca.shadowRoot.querySelector('search-view');
    const pp = sv && sv.shadowRoot && sv.shadowRoot.querySelector('preview-pane');
    if (!pp) return { error: 'NO_PREVIEW_PANE' };
    const mdv = pp.shadowRoot && pp.shadowRoot.querySelector('md-viewer');
    if (!mdv) return { error: 'NO_MD_VIEWER', language: pp.language };
    const root = mdv.shadowRoot;
    const flashed = root && root.querySelector('.highlight-flash');
    const marked = root ? Array.from(root.querySelectorAll('[data-source-line]')) : [];
    return {
      ok: true,
      mdvLine: mdv.line,
      mdvContentLen: (mdv.content || '').length,
      hasFlashed: !!flashed,
      flashedLine: flashed ? flashed.getAttribute('data-source-line') : null,
      totalMarkedBlocks: marked.length,
    };
  });
}
