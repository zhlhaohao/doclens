要实现 GLM-5 的服务端自动搜索（即无需客户端手动往返处理工具调用），最关键的是使用智谱 AI（Z.AI）原生支持的 web_search 工具协议。
智谱的 API 端点在接收到特定格式的 tools 定义时，会自动在云端执行搜索并直接返回最终整合后的答案。
## 完整 Python 代码 (通过 Anthropic SDK 调用)
你可以继续使用 Anthropic SDK，只需将 tools 的结构按照智谱官方的 原生插件格式 进行调整。

import anthropic
# 1. 初始化客户端client = anthropic.Anthropic(
    api_key="你的_ZAI_API_KEY", 
    base_url="https://z.ai" 
)
# 2. 开启服务端自动搜索的关键：定义原生的 web_search 工具# 注意：使用 type: "web_search" 智谱服务器会自动处理搜索逻辑tools = [
    {
        "type": "web_search",  # 必须使用 type 字段
        "web_search": {
            "enable": True,    # 开启搜索
            "search_query": "auto" # 自动提取关键词
        }
    }
]
# 3. 发起请求response = client.messages.create(
    model="glm-5", 
    max_tokens=4096,
    tools=tools, # 传入搜索工具定义
    messages=[
        {"role": "user", "content": "帮我搜一下今天最新的科技新闻，并总结要点。"}
    ],
    # 强制开启 Thinking 模式（可选，GLM-5 强项）
    extra_body={
        "thinking": {"type": "enabled"}
    }
)
# 4. 直接获取最终结果# 在服务端搜索模式下，模型会直接返回带参考来源的最终回答
print(response.content[0].text)

## 为什么这段代码能实现“服务端搜索”？

   1. 原生协议支持：当 tools 列表包含 {"type": "web_search", ...} 时，智谱的网关会识别这是一个内置插件请求，而不是普通的自定义函数调用。
   2. 自动执行：智谱服务器会代替你的 Python 代码去调用其内部的搜索引擎（Search Pro），并将检索到的网页内容直接喂给模型进行总结。
   3. 引用透明：模型返回的文本通常会自动包含类似 [1]、[2] 的引用标注，指向它搜索到的实时网页。 [1, 2] 

## 注意事项：

* 端点选择：请确保 base_url 指向智谱的兼容地址（如 https://z.ai 或 https://open.bigmodel.cn/api/paas/v4）。
* 额度消耗：开启 web_search 可能会产生额外的搜索 Token 消耗，具体取决于你的套餐。
* 模型版本：glm-5 和 glm-5-turbo 均原生支持此能力，但在复杂工程任务上推荐使用 glm-5.1 以获得更好的搜索整合效果。 [3, 4, 5, 6] 

如果搜索结果没有返回，请检查您的 API 账户是否已在 智谱后台 开启了联网权限。

[1] [https://github.com](https://github.com/openclaw/openclaw/issues/17925)
[2] [https://docs.bigmodel.cn](https://docs.bigmodel.cn/cn/guide/tools/web-search)
[3] [https://docs.bigmodel.cn](https://docs.bigmodel.cn/cn/guide/models/text/glm-5)
[4] [https://docs.bigmodel.cn](https://docs.bigmodel.cn/cn/guide/start/quick-start)
[5] [https://docs.bigmodel.cn](https://docs.bigmodel.cn/cn/coding-plan/faq)
[6] [https://www.reddit.com](https://www.reddit.com/r/AIToolsPerformance/comments/1rvxqne/glm5turbo_zais_new_agentfirst_language_model/)
