#!/usr/bin/env python3
"""52 条搜索验证问题执行器"""

import sys
import os
import io

os.chdir(os.path.join(os.path.dirname(__file__), '..', 'test_work_dir'))

from doclens.cortex_cli import NotebookSearchCLI
from doclens.formatting import strip_ansi

results = []

def capture_stdout(func):
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        func()
    except Exception as e:
        sys.stdout = old
        return buf.getvalue() + f"\n[异常] {e}"
    sys.stdout = old
    return buf.getvalue()

cli = NotebookSearchCLI()
cli.load_or_build_index()

questions = [
    ("Q-001", "量子计算 13000倍加速"),
    ("Q-002", "Google Quantum AI"),
    ("Q-003", "潘建伟 三阶段发展"),
    ("Q-004", "Quantinuum Helios 离子阱"),
    ("Q-005", "脑机接口 有感情地说话"),
    ("Q-006", "可解释人工智能 神经网络量子态"),
    ("Q-007", "中性原子量子计算 一体化芯片"),
    ("Q-008", "量子纠错 架构"),
    ("Q-009", "140万亿 词元调用"),
    ("Q-010", "McKinsey Quantum Technology Monitor"),
    ("Q-011", "量子技术投资 硬件占比45%"),
    ("Q-012", "药物分子模拟 金融风险建模"),
    ("Q-013", "全球GDP增长 2.7% 3.1%"),
    ("Q-014", "四重变局 地缘冲突 贸易保护"),
    ("Q-015", "英伟达市值 5万亿美元"),
    ("Q-016", "中国研发经费投入 2.8% OECD"),
    ("Q-017", "WTO 货物贸易增长 0.5%"),
    ("Q-018", "AI新十大建设 台湾"),
    ("Q-019", "俄罗斯 数据经济 国家科技"),
    ("Q-020", "Python NumPy Pandas Scikit-learn"),
    ("Q-021", "鸢尾花分类 RandomForest"),
    ("Q-022", "交叉验证 GridSearchCV 超参数"),
    ("Q-023", "K-Means 聚类 StandardScaler"),
    ("Q-024", "PyTorch 神经网络 Linear ReLU"),
    ("Q-025", "波士顿房价 LinearRegression"),
    ("Q-026", "虚拟环境 venv pip install"),
    ("Q-027", "膳食纤维 25克 30克 肠道健康"),
    ("Q-028", "多酚 蓝莓 绿茶 抗氧化"),
    ("Q-029", "WHO 有氧运动 150分钟 力量训练"),
    ("Q-030", "睡眠管理 褪黑素 GABA 酸枣仁"),
    ("Q-031", "Z世代 保健营养品 情绪调节"),
    ("Q-032", "蛋白质粉 维生素B族 南非醉茄"),
    ("Q-033", "吃动平衡 健康体重 全民营养周"),
    ("Q-034", "正念冥想 内啡肽 压力管理"),
    ("Q-035", "McKinsey 50% 60% 饮食锻炼"),
    ("Q-036", "GDP 美国中国日本德国"),
    ("Q-037", "研发投入强度 韩国4.9%"),
    ("Q-038", "AI产业规模 1850亿美元"),
    ("Q-039", "量子技术投资 2023 2024 2025"),
    ("Q-040", "GPU出货量 AI专利申请"),
    ("Q-041", "蛋白质60克 钙800毫克 维生素D"),
    ("Q-042", "Omega-3 深海鱼 心血管保护"),
    ("Q-043", "HIIT 18岁30岁 心率170"),
    ("Q-044", "Google Oratomic 加密 TIME"),
    ("Q-045", "Nature 量子优越性 物理模拟"),
    ("Q-046", "能源转型 数字货币 供应链重构"),
    ("Q-047", "新冠蓝海 健康消费 运动人群 补充剂"),
    ("Q-048", "India GDP 6.5% fastest growth"),
    ("Q-049", "matplotlib 折线图 柱状图 数据可视化"),
    ("Q-050", "IonQ IBM ColdQuanta quantum companies"),
    ("Q-051", "simulation platforms algorithms investment record"),
    ("Q-052", "brain computer interface sing emotion patients"),
]

import json

for qid, query in questions:
    output = capture_stdout(lambda q=query: cli.format_results(*cli.do_search(q), q))
    plain = strip_ansi(output)
    has_result = "找到" in output and "+-- [" in output
    count = output.count("+-- [")

    # 提取命中的文件
    files = []
    for line in plain.split("\n"):
        if "文件:" in line:
            # 提取路径中的文件名
            parts = line.split("test_work_dir/")
            if len(parts) > 1:
                fname = parts[1].split(":")[0]
                files.append(fname)

    conclusion = "✅ 通过" if has_result else "❌ 未通过"
    results.append({
        "id": qid,
        "query": query,
        "conclusion": conclusion,
        "count": count,
        "files": files,
        "output": output[:300]
    })
    print(f"{qid}: {conclusion} | {query} → {count}条, 文件: {', '.join(files[:3])}")

# 汇总
passed = sum(1 for r in results if "✅" in r["conclusion"])
failed = sum(1 for r in results if "❌" in r["conclusion"])
print(f"\n通过: {passed}/{len(results)}, 未通过: {failed}/{len(results)}")

with open(os.path.join("..", "doclens", "test_results_q.json"), "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
