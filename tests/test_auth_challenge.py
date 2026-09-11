# -*- coding: utf-8 -*-
"""登录挑战-响应（方案 C，2026-09-11）协议测试。

覆盖：
- nonce 生命周期：签发/一次性消费/过期/来源 IP 绑定/超量淘汰
- proof 计算/校验与常数时间比对
- 端到端协议：challenge → 客户端式 PBKDF2+HMAC（用后端同式模拟）→ login 通过
- 明文兼容路径仍可用（环回/调试）
- 错误 proof / 重放 nonce 拒绝
"""
import hashlib
import hmac as hmac_mod
import time

import pytest

from doclens.web_v2 import auth_challenge
from doclens.web_v2.auth_challenge import (
    compute_proof, consume_nonce, issue_nonce, verify_proof,
)


def _pbkdf2_hex(pin: str, salt_hex: str, iterations: int) -> str:
    """与前端 auth-crypto.ts 同式（也是服务端存储哈希的原式）。"""
    return hashlib.pbkdf2_hmac(
        "sha256", pin.encode(), bytes.fromhex(salt_hex), iterations
    ).hex()


class TestNonce:
    def test_issue_and_consume_once(self):
        n = issue_nonce("1.2.3.4")
        assert consume_nonce(n, "1.2.3.4") is True
        assert consume_nonce(n, "1.2.3.4") is False  # 一次性

    def test_ip_binding(self):
        n = issue_nonce("1.2.3.4")
        assert consume_nonce(n, "5.6.7.8") is False  # 换 IP 无效
        assert consume_nonce(n, "1.2.3.4") is False  # 消费已发生（绑定失败也算消费）

    def test_expiry(self, monkeypatch):
        n = issue_nonce("1.1.1.1")
        # 快进时钟越过 TTL
        real = time.monotonic
        monkeypatch.setattr(auth_challenge.time, "monotonic", lambda: real() + auth_challenge.NONCE_TTL_S + 1)
        assert consume_nonce(n, "1.1.1.1") is False

    def test_per_ip_cap(self):
        for _ in range(auth_challenge._MAX_PENDING_PER_IP + 2):
            issue_nonce("9.9.9.9")
        mine = [n for n, (_, ip) in auth_challenge._pending.items() if ip == "9.9.9.9"]
        assert len(mine) <= auth_challenge._MAX_PENDING_PER_IP


class TestProof:
    def test_compute_matches_manual(self):
        pb = _pbkdf2_hex("123456", "aa" * 16, 1000)
        expected = hmac_mod.new(b"nonce123", bytes.fromhex(pb), hashlib.sha256).hexdigest()
        assert compute_proof("nonce123", pb) == expected

    def test_verify_ok_and_fail(self):
        pb = _pbkdf2_hex("654321", "bb" * 16, 1000)
        proof = compute_proof("n1", pb)
        assert verify_proof("n1", pb, proof) is True
        assert verify_proof("n1", pb, "0" * 64) is False
        assert verify_proof("n2", pb, proof) is False  # nonce 不同
        assert verify_proof("n1", pb, "") is False


class TestProtocolEndToEnd:
    """模拟完整协议（用 FastAPI TestClient + 临时全局目录）。"""

    @pytest.fixture()
    def client_env(self, tmp_path, monkeypatch):
        from doclens.web_v2 import auth_credentials
        monkeypatch.setattr(auth_credentials, "_env_path", lambda: tmp_path / ".env")
        auth_credentials.set_password("123456")
        yield
        auth_credentials.clear_password()

    def _login(self, c, pin: str, salt: str, iterations: int):
        ch = c.get("/api/auth/challenge").json()
        assert ch["salt"] == salt and ch["iterations"] == iterations
        pb = _pbkdf2_hex(pin, salt, iterations)
        proof = compute_proof(ch["nonce"], pb)
        return c.post("/api/auth/login", json={"proof": proof, "nonce": ch["nonce"]})

    def test_challenge_login_flow(self, client_env):
        from fastapi.testclient import TestClient
        from doclens.web_v2.app import create_app
        with TestClient(create_app()) as c:
            salt = "aa" * 16
            r = self._login(c, "123456", salt, 100_000) if False else None
            # salt 以服务端为准（上面 set_password 自生成）——直接读挑战
            ch = c.get("/api/auth/challenge").json()
            pb = _pbkdf2_hex("123456", ch["salt"], ch["iterations"])
            proof = compute_proof(ch["nonce"], pb)
            r = c.post("/api/auth/login", json={"proof": proof, "nonce": ch["nonce"]})
            assert r.status_code == 200

    def test_wrong_pin_rejected(self, client_env):
        from fastapi.testclient import TestClient
        from doclens.web_v2.app import create_app
        with TestClient(create_app()) as c:
            ch = c.get("/api/auth/challenge").json()
            pb = _pbkdf2_hex("000000", ch["salt"], ch["iterations"])  # 错 PIN
            proof = compute_proof(ch["nonce"], pb)
            r = c.post("/api/auth/login", json={"proof": proof, "nonce": ch["nonce"]})
            assert r.status_code == 401

    def test_replay_rejected(self, client_env):
        from fastapi.testclient import TestClient
        from doclens.web_v2.app import create_app
        with TestClient(create_app()) as c:
            ch = c.get("/api/auth/challenge").json()
            pb = _pbkdf2_hex("123456", ch["salt"], ch["iterations"])
            proof = compute_proof(ch["nonce"], pb)
            r1 = c.post("/api/auth/login", json={"proof": proof, "nonce": ch["nonce"]})
            r2 = c.post("/api/auth/login", json={"proof": proof, "nonce": ch["nonce"]})  # 重放
            assert r1.status_code == 200
            assert r2.status_code == 401

    def test_plaintext_compat_still_works(self, client_env):
        from fastapi.testclient import TestClient
        from doclens.web_v2.app import create_app
        with TestClient(create_app()) as c:
            r = c.post("/api/auth/login", json={"password": "123456"})
            assert r.status_code == 200
            r = c.post("/api/auth/login", json={"password": "000000"})
            assert r.status_code == 401

    def test_no_password_challenge_400(self, tmp_path, monkeypatch):
        from doclens.web_v2 import auth_credentials
        monkeypatch.setattr(auth_credentials, "_env_path", lambda: tmp_path / "empty.env")
        from fastapi.testclient import TestClient
        from doclens.web_v2.app import create_app
        with TestClient(create_app()) as c:
            assert c.get("/api/auth/challenge").status_code == 400

    def test_set_password_hashed_path(self, client_env, monkeypatch):
        """挑战化设置密码：客户端自生成 salt + PBKDF2 提交，服务端直存。"""
        from doclens.web_v2 import auth_credentials
        from doclens.web_v2.api import auth as auth_api
        from fastapi.testclient import TestClient
        from doclens.web_v2.app import create_app
        # TestClient 来源 host 非环回 → 闸门要求会话；patch 关闸模拟环回场景
        monkeypatch.setattr(auth_api, "gate_enabled_for_client", lambda ip, has: False)
        with TestClient(create_app()) as c:
            # 已设密码（fixture 设了 123456）→ 改密必须带旧密码的挑战 proof
            ch_old = c.get("/api/auth/challenge").json()
            old_pb = _pbkdf2_hex("123456", ch_old["salt"], ch_old["iterations"])
            old_proof = compute_proof(ch_old["nonce"], old_pb)

            new_salt = "cc" * 16
            new_hash = _pbkdf2_hex("999999", new_salt, 100_000)
            r = c.put("/api/auth/password", json={
                "old_proof": old_proof, "old_nonce": ch_old["nonce"],
                "new_salt": new_salt, "new_hash": new_hash,
            })
            assert r.status_code == 200
            stored = auth_credentials.stored_params()
            assert stored[1] == new_salt and stored[2] == new_hash
            # 新密码可挑战登录
            ch = c.get("/api/auth/challenge").json()
            pb = _pbkdf2_hex("999999", ch["salt"], ch["iterations"])
            r2 = c.post("/api/auth/login", json={
                "proof": compute_proof(ch["nonce"], pb), "nonce": ch["nonce"],
            })
            assert r2.status_code == 200
