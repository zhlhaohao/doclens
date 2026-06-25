async (page) => {
  return await page.evaluate(() => {
    const bodyChildren = Array.from(document.body.children).map(el => el.tagName);
    const cortexApp = document.querySelector('cortex-app');
    const cortexRoot = cortexApp && cortexApp.shadowRoot;
    const cortexChildren = cortexRoot ? Array.from(cortexRoot.children).map(el => el.tagName) : [];
    return { bodyChildren, cortexChildren };
  });
}
