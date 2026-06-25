async (page) => {
  // result-card 在 search-view shadow root 内，shadow piercing 用 >>> 或 page.locator 通配
  // 实测：page.locator('result-card') 默认不穿透 shadow；需要用 >> 链
  const card = page.locator('search-view >> result-card', { hasText: '.md' }).first();
  const count = await card.count();
  if (count === 0) throw new Error('NO_MD_CARD');
  await card.click();
  return 'CLICKED';
}
