# NotebookSearch CLI 启动脚本
# 使用当前工作目录作为搜索和建索引目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$ScriptDir\.venv\Scripts\python.exe" -m cortex $args
