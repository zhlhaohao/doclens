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
/* ===== 页面布局 ===== */
.gradio-container {
    background: #F5F5F7 !important;
    max-width: 860px !important;
    margin: 0 auto !important;
    padding: 24px 16px !important;
}

/* ===== 页面标题 ===== */
.cortex-header {
    font-size: 28px;
    font-weight: 700;
    color: #1D1D1F;
    text-align: center;
    padding: 16px 0 8px 0;
    letter-spacing: -0.5px;
}
.cortex-header-sub {
    font-size: 14px;
    color: #86868B;
    text-align: center;
    margin-bottom: 20px;
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

/* ===== 搜索框区域 ===== */
.search-input-row {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    margin-bottom: 16px;
}
.search-input-row input,
.search-input-row textarea {
    border-radius: 12px !important;
    border: 1.5px solid #E5E5EA !important;
    font-size: 15px !important;
    padding: 12px 16px !important;
    transition: all 0.2s ease !important;
    background: #FAFAFA !important;
}
.search-input-row input:focus,
.search-input-row textarea:focus {
    border-color: #0D9488 !important;
    box-shadow: 0 0 0 3px rgba(13,148,136,0.1) !important;
    background: #FFFFFF !important;
}
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

/* ===== 搜索结果卡片 ===== */
.search-results-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.search-card {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: all 0.25s ease;
    border: 1px solid rgba(0,0,0,0.03);
}
.search-card:hover {
    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
    transform: translateY(-1px);
}
.search-card-path {
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    font-size: 12px;
    color: #86868B;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.search-card-path svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}
.search-card-title {
    font-size: 16px;
    font-weight: 600;
    color: #1D1D1F;
    margin-bottom: 8px;
    line-height: 1.4;
}
.search-card-snippet {
    font-size: 14px;
    color: #4A4A4F;
    line-height: 1.65;
    margin-bottom: 12px;
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
