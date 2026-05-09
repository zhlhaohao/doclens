# Python 数据科学与机器学习实用指南

## 一、Python 环境搭建

### 1.1 安装 Python

推荐使用 Python 3.11 或更高版本。可以从 python.org 下载安装包，或使用 Anaconda 发行版。

```bash
# 验证安装
python --version
pip --version
```

### 1.2 虚拟环境

使用虚拟环境隔离项目依赖是最佳实践：

```bash
python -m venv myproject
source myproject/bin/activate  # Linux/Mac
myproject\Scripts\activate     # Windows
```

### 1.3 核心库安装

```bash
pip install numpy pandas matplotlib scikit-learn jupyter
```

## 二、NumPy 数值计算

### 2.1 数组创建与操作

NumPy 是Python数值计算的基础库，提供了高效的多维数组操作。

```python
import numpy as np

# 创建数组
arr = np.array([1, 2, 3, 4, 5])
matrix = np.array([[1, 2, 3], [4, 5, 6]])

# 数组运算
arr_squared = arr ** 2
matrix_sum = matrix.sum(axis=0)

# 随机数
random_arr = np.random.randn(1000)
```

### 2.2 线性代数

```python
# 矩阵乘法
A = np.random.randn(3, 3)
B = np.random.randn(3, 2)
C = np.dot(A, B)

# 特征值分解
eigenvalues, eigenvectors = np.linalg.eig(A)
```

## 三、Pandas 数据处理

### 3.1 DataFrame 基础

Pandas 提供了 DataFrame 和 Series 两种核心数据结构，是数据处理的利器。

```python
import pandas as pd

# 创建 DataFrame
df = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie', 'Diana'],
    'age': [25, 30, 35, 28],
    'score': [85.5, 92.3, 78.1, 95.7]
})

# 基本统计
print(df.describe())
print(df['score'].mean())
```

### 3.2 数据清洗

```python
# 处理缺失值
df.isnull().sum()
df.fillna(df.mean(), inplace=True)
df.dropna(subset=['score'], inplace=True)

# 数据类型转换
df['age'] = df['age'].astype(float)

# 分组聚合
grouped = df.groupby('age')['score'].agg(['mean', 'std', 'count'])
```

## 四、Matplotlib 数据可视化

### 4.1 基础图表

```python
import matplotlib.pyplot as plt

# 折线图
plt.figure(figsize=(10, 6))
plt.plot([1, 2, 3, 4], [10, 20, 25, 30], 'b-o')
plt.xlabel('X轴')
plt.ylabel('Y轴')
plt.title('示例折线图')
plt.show()

# 柱状图
plt.bar(['A', 'B', 'C', 'D'], [15, 22, 18, 27])
plt.title('分类数据柱状图')
plt.show()
```

## 五、Scikit-learn 机器学习

### 5.1 分类：鸢尾花数据集

机器学习中最经典的入门案例是鸢尾花分类。Scikit-learn 内置了该数据集。

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# 加载数据
iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data, iris.target, test_size=0.3, random_state=42
)

# 训练随机森林
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# 评估
y_pred = clf.predict(X_test)
print(f"准确率: {accuracy_score(y_test, y_pred):.4f}")
print(classification_report(y_test, y_pred, target_names=iris.target_names))
```

### 5.2 回归：波士顿房价预测

```python
from sklearn.datasets import fetch_california_housing
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

housing = fetch_california_housing()
X_train, X_test, y_train, y_test = train_test_split(
    housing.data, housing.target, test_size=0.2, random_state=42
)

model = LinearRegression()
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

print(f"MSE: {mean_squared_error(y_test, y_pred):.4f}")
print(f"R²: {r2_score(y_test, y_pred):.4f}")
```

### 5.3 聚类：K-Means

```python
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# 标准化数据
scaler = StandardScaler()
X_scaled = scaler.fit_transform(iris.data)

# K-Means 聚类
kmeans = KMeans(n_clusters=3, random_state=42)
labels = kmeans.fit_predict(X_scaled)
```

## 六、模型评估与调优

### 6.1 交叉验证

交叉验证是评估模型泛化能力的重要方法，避免过拟合。

```python
from sklearn.model_selection import cross_val_score

scores = cross_val_score(clf, iris.data, iris.target, cv=5)
print(f"交叉验证准确率: {scores.mean():.4f} ± {scores.std():.4f}")
```

### 6.2 超参数搜索

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [None, 5, 10, 20],
    'min_samples_split': [2, 5, 10]
}

grid_search = GridSearchCV(
    RandomForestClassifier(random_state=42),
    param_grid, cv=5, scoring='accuracy', n_jobs=-1
)
grid_search.fit(X_train, y_train)
print(f"最佳参数: {grid_search.best_params_}")
print(f"最佳分数: {grid_search.best_score_:.4f}")
```

## 七、深度学习入门

### 7.1 PyTorch 基础

```python
import torch
import torch.nn as nn

# 定义简单神经网络
class SimpleNet(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        return out

model = SimpleNet(4, 16, 3)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
```

## 八、项目实践建议

1. **从简单开始**：先理解数据，再建模
2. **重视数据清洗**：垃圾进，垃圾出
3. **可视化先行**：画图帮助理解数据分布和模式
4. **交叉验证**：不要只看训练集表现
5. **持续学习**：关注 Kaggle 竞赛和学术论文
6. **版本管理**：使用 Git 管理代码和实验
7. **文档记录**：记录实验参数和结果
8. **团队合作**：数据科学是团队运动
