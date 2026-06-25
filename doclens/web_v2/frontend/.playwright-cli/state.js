async (page) => {
  return await page.evaluate(() => {
    const pp = document.querySelector('preview-pane');
    if (!pp) return 'NO_PP';
    const sr = pp.shadowRoot;
    if (!sr) return 'NO_SR';
    const mdv = sr.querySelector('md-viewer');
    const body = sr.querySelector('.body');
    const empty = sr.querySelector('.empty');
    const header = sr.querySelector('.header');
    return {
      hasMdViewer: !!mdv,
      hasBody: !!body,
      hasEmpty: !!empty,
      emptyText: empty ? empty.textContent : null,
      hasHeader: !!header,
      headerText: header ? header.textContent : null,
      mdvContent: mdv ? mdv.getAttribute('content') : null,
      mdvLine: mdv ? mdv.line : null,
    };
  });
}
