"""auth_password 纯函数测试。"""
import pytest

from doclens.web_v2.auth_password import (
    PBKDF2_ITERATIONS,
    hash_password,
    validate_pin_format,
    verify_password,
)


class TestValidatePinFormat:
    @pytest.mark.parametrize("pin", ["123456", "000000", "999999"])
    def test_valid(self, pin):
        assert validate_pin_format(pin) is True

    @pytest.mark.parametrize(
        "pin",
        ["12345", "1234567", "", "abcdef", "12345a", "123 56", "１２３４５６"],
    )
    def test_invalid(self, pin):
        assert validate_pin_format(pin) is False


class TestHashAndVerify:
    def test_roundtrip(self):
        salt_hex, hash_hex = hash_password("654321")
        assert verify_password("654321", salt_hex, hash_hex) is True
        assert verify_password("654322", salt_hex, hash_hex) is False

    def test_hash_rejects_invalid_format(self):
        with pytest.raises(ValueError):
            hash_password("12345")

    def test_salt_is_random(self):
        s1, _ = hash_password("123456")
        s2, _ = hash_password("123456")
        assert s1 != s2

    def test_verify_with_malformed_stored_values(self):
        assert verify_password("123456", "not-hex", "also-not-hex") is False

    def test_verify_respects_iterations(self):
        salt_hex, hash_hex = hash_password("123456")
        # 迭代次数不匹配 → 校验失败
        assert verify_password("123456", salt_hex, hash_hex, iterations=PBKDF2_ITERATIONS + 1) is False
