async (page) => {
  return await page.evaluate(() => {
    function dump(el, depth) {
      if (depth > 4) return '';
      let out = '';
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') return '';
      out += '  '.repeat(depth) + tag;
      if (el.shadowRoot) {
        const kids = Array.from(el.shadowRoot.children);
        out += ' [shadow:' + kids.map(k => k.tagName.toLowerCase()).join(',') + ']\n';
        for (const k of kids) out += dump(k, depth + 1);
      } else if (el.children.length > 0 && depth < 3) {
        out += '\n';
        for (const k of el.children) out += dump(k, depth + 1);
      } else {
        out += '\n';
      }
      return out;
    }
    return dump(document.body, 0).split('\n').slice(0, 40).join('\n');
  });
}
