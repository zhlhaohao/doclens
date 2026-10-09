# [doclens] ADR-0039 副作用斩断：上游 ConfigManager 会读写
# ~/.config/PDFMathTranslate/config.json（含 translator envs 写回）。本集成中
# 翻译凭据统一走宿主「翻译预设」（presets_store，kind=translate），envs 由
# 宿主在每次翻译时注入，引擎侧不再持久化任何配置。
# 保留类名与 get/set 签名（translator.py / high_level.py 引用），改为
# 进程内存态：get 只查 os.environ（如 NOTO_FONT_PATH 覆盖字体路径），
# set 为 no-op。


class ConfigManager:
    """进程内存配置（os.environ 只读视图 + 显式 set 覆盖）。"""

    _overrides: dict = {}

    @classmethod
    def get_instance(cls):
        return cls

    @classmethod
    def get(cls, key, default=None):
        if key in cls._overrides:
            return cls._overrides[key]
        import os

        return os.environ.get(key, default)

    @classmethod
    def set(cls, key, value):
        cls._overrides[key] = value

    @classmethod
    def all(cls):
        return dict(cls._overrides)

    @classmethod
    def delete(cls, key):
        cls._overrides.pop(key, None)

    @classmethod
    def clear(cls):
        cls._overrides.clear()

    # ---- 上游 translator envs 持久化接口：斩断（no-op / 返回空）----

    @classmethod
    def custome_config(cls, file_path):
        raise NotImplementedError(
            "custom config file is not supported in doclens build (ADR-0039)"
        )

    @classmethod
    def get_translator_by_name(cls, name):
        return None

    @classmethod
    def set_translator_by_name(cls, name, envs):
        # no-op：envs 由宿主每次注入，不持久化
        pass

    @classmethod
    def get_env_by_translatername(cls, translater_name, env_name, default=None):
        return default
