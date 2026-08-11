import os
from collections import Counter

ROOT = "diary"
counter = Counter()
total = 0

for dirpath, _, filenames in os.walk(ROOT):
    for fn in filenames:
        ext = os.path.splitext(fn)[1].lower()
        if not ext:
            ext = "(无扩展名)"
        counter[ext] += 1
        total += 1

exts = sorted(counter.items(), key=lambda x: (-x[1], x[0]))

# 表格输出
w1 = max(len("文件类型"), max(len(e) for e, _ in exts)) if exts else 8
w2 = max(len("数量"), len(str(total)))
sep = "+" + "-" * (w1 + 2) + "+" + "-" * (w2 + 2) + "+"

print(sep)
print(f"| {'文件类型'.ljust(w1)} | {'数量'.rjust(w2)} |")
print(sep)
for ext, cnt in exts:
    print(f"| {ext.ljust(w1)} | {str(cnt).rjust(w2)} |")
print(sep)
print(f"| {'合计'.ljust(w1)} | {str(total).rjust(w2)} |")
print(sep)