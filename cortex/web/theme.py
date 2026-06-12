"""Bento Grid 风格主题与 CSS 配置"""

import gradio as gr


def get_bento_theme() -> gr.themes.Base:
    """返回 Bento Grid 风格的 Gradio Theme（Apple 风格现代感）"""
    return gr.themes.Soft(
        primary_hue=gr.themes.colors.teal,
        secondary_hue=gr.themes.colors.slate,
        neutral_hue=gr.themes.colors.gray,
        spacing_size=gr.themes.sizes.spacing_md,
        radius_size=gr.themes.sizes.radius_lg,
        font=gr.themes.GoogleFont("Plus Jakarta Sans"),
    )


CSS = """
/* ===== 页面布局 — 全宽 ===== */
.gradio-container {
    background: #F5F5F7 !important;
    margin: 0 auto !important;
    padding: 24px 32px !important;
}

/* ===== Hero 初始状态：大搜索框居中 ===== */
.hero-section {
    max-width: 640px !important;
    margin: 80px auto 0 auto !important;
}
.hero-title {
    font-size: 32px;
    font-weight: 700;
    color: #1D1D1F;
    text-align: center;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
}
.hero-subtitle {
    font-size: 15px;
    color: #86868B;
    text-align: center;
    margin-bottom: 32px;
}
.hero-search-row {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}
.hero-search-row input,
.hero-search-row textarea {
    border-radius: 12px !important;
    border: 1.5px solid #E5E5EA !important;
    font-size: 16px !important;
    padding: 14px 18px !important;
    transition: all 0.2s ease !important;
    background: #FAFAFA !important;
}
.hero-search-row input:focus,
.hero-search-row textarea:focus {
    border-color: #0D9488 !important;
    box-shadow: 0 0 0 3px rgba(13,148,136,0.1) !important;
    background: #FFFFFF !important;
}

/* ===== 紧凑搜索栏（搜索后） ===== */
.compact-search-row {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 10px 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    margin-bottom: 16px;
}
.compact-search-row input,
.compact-search-row textarea {
    border-radius: 10px !important;
    border: 1.5px solid #E5E5EA !important;
    font-size: 14px !important;
    padding: 10px 14px !important;
    transition: all 0.2s ease !important;
    background: #FAFAFA !important;
}
.compact-search-row input:focus,
.compact-search-row textarea:focus {
    border-color: #0D9488 !important;
    box-shadow: 0 0 0 3px rgba(13,148,136,0.1) !important;
    background: #FFFFFF !important;
}

/* ===== 搜索按钮通用 ===== */
.search-btn {
    border-radius: 12px !important;
    font-weight: 600 !important;
    padding: 12px 24px !important;
    background: #0D9488 !important;
    color: #FFFFFF !important;
    border: none !important;
    transition: all 0.2s ease !important;
}
.search-btn:hover {
    background: #0F766E !important;
    box-shadow: 0 4px 12px rgba(13,148,136,0.3) !important;
}

/* ===== Tab 标签栏 ===== */
.tabs {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    margin-bottom: 16px;
}
.tab-nav {
    gap: 4px !important;
}
.tab-nav button {
    border-radius: 10px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    color: #86868B !important;
    padding: 8px 20px !important;
    border: none !important;
    background: transparent !important;
    transition: all 0.2s ease !important;
}
.tab-nav button.selected {
    background: #0D9488 !important;
    color: #FFFFFF !important;
    box-shadow: 0 2px 6px rgba(13,148,136,0.25) !important;
}
.tab-nav button:hover:not(.selected) {
    background: #F0F0F2 !important;
    color: #1D1D1F !important;
}

/* ===== 双栏布局 ===== */
.search-layout {
    gap: 16px !important;
}
.search-results-col {
    min-width: 0 !important;
}
.preview-col {
    min-width: 0 !important;
}

/* ===== 搜索结果卡片 ===== */
.search-results-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 600px;
    overflow-y: auto;
    padding-right: 4px;
}
.search-results-container::-webkit-scrollbar {
    width: 4px;
}
.search-results-container::-webkit-scrollbar-thumb {
    background: #D2D2D7;
    border-radius: 2px;
}

.search-card {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: all 0.25s ease;
    border: 2px solid transparent;
    cursor: pointer;
}
.search-card:hover {
    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
    transform: translateY(-1px);
}
.search-card.active {
    border-color: #0D9488 !important;
    box-shadow: 0 4px 16px rgba(13,148,136,0.15) !important;
}

.search-card-path {
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    font-size: 12px;
    color: #86868B;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.search-card-path svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}
.search-card-snippet {
    font-size: 14px;
    color: #4A4A4F;
    line-height: 1.65;
    margin-bottom: 12px;
    word-break: break-word;
    overflow-wrap: break-word;
}
.search-card-snippet mark {
    background: rgba(13,148,136,0.12);
    color: #0D9488;
    padding: 1px 4px;
    border-radius: 4px;
    font-weight: 600;
}

/* ===== 评分条 ===== */
.score-bar-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
}
.score-bar-track {
    flex: 1;
    height: 8px;
    background: #F0F0F2;
    border-radius: 4px;
    overflow: hidden;
    max-width: 200px;
}
.score-bar-fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, #14B8A6, #0D9488);
    transition: width 0.4s ease;
}
.score-bar-label {
    font-size: 13px;
    font-weight: 600;
    color: #86868B;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

/* ===== 结果统计栏 ===== */
.result-stats {
    font-size: 14px;
    color: #86868B;
    margin-bottom: 12px;
    padding-left: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.result-stats strong {
    color: #1D1D1F;
    font-weight: 600;
}

/* ===== 空状态 ===== */
.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #86868B;
}
.empty-state svg {
    width: 48px;
    height: 48px;
    color: #D2D2D7;
    margin-bottom: 16px;
}
.empty-state-title {
    font-size: 18px;
    font-weight: 600;
    color: #1D1D1F;
    margin-bottom: 8px;
}
.empty-state-desc {
    font-size: 14px;
    color: #86868B;
    line-height: 1.5;
}

/* ===== 文件预览面板 ===== */
.preview-panel {
    background: #FFFFFF;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    border: 1px solid rgba(0,0,0,0.03);
    height: 600px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.preview-header {
    padding: 16px 20px;
    border-bottom: 1px solid #F0F0F2;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}
.preview-header-path {
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    font-size: 13px;
    color: #86868B;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.preview-header svg {
    width: 16px;
    height: 16px;
    color: #0D9488;
    flex-shrink: 0;
}
.preview-content {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
    font-size: 14px;
    line-height: 1.7;
    color: #1D1D1F;
    white-space: pre-wrap;
    word-break: break-word;
}
.preview-content::-webkit-scrollbar {
    width: 4px;
}
.preview-content::-webkit-scrollbar-thumb {
    background: #D2D2D7;
    border-radius: 2px;
}
.preview-content .line-number {
    display: inline-block;
    width: 40px;
    color: #86868B;
    text-align: right;
    margin-right: 16px;
    user-select: none;
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    font-size: 12px;
}
.preview-content .highlight-line {
    background: rgba(13,148,136,0.06);
    border-left: 3px solid #0D9488;
    margin: 0 -20px;
    padding: 0 17px;
}
.preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #86868B;
    text-align: center;
    padding: 40px;
}
.preview-empty svg {
    width: 40px;
    height: 40px;
    color: #D2D2D7;
    margin-bottom: 12px;
}
.preview-empty-title {
    font-size: 15px;
    font-weight: 500;
    color: #1D1D1F;
    margin-bottom: 4px;
}
.preview-empty-desc {
    font-size: 13px;
    color: #86868B;
}

/* ===== 隐藏 input（用于卡片点击通信） ===== */
.hidden-input {
    height: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    opacity: 0 !important;
    position: absolute !important;
    pointer-events: none !important;
}

/* ===== AI 对话 Tab 对齐 ===== */
.chatbot-container {
    border-radius: 16px !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
    border: 1px solid rgba(0,0,0,0.03) !important;
}
.chatbot-container .message {
    border-radius: 12px !important;
}
"""
