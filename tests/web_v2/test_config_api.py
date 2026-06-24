"""Integration tests for /api/config endpoints via FastAPI TestClient."""
import pytest
from fastapi.testclient import TestClient

from doclens.web_v2.app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    """App client with cwd and HOME both pointed at tmp_path."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    return TestClient(create_app())


def test_get_local_config_returns_all_keys_when_file_missing(client, tmp_path):
    resp = client.get("/api/config", params={"scope": "local"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["scope"] == "local"
    assert body["exists"] is False
    # All 18 keys present with empty values
    assert len(body["values"]) == 18
    assert all(v == "" for v in body["values"].values())


def test_get_local_config_reads_existing_values(client, tmp_path):
    env_path = tmp_path / ".cortex" / ".env"
    env_path.parent.mkdir(parents=True)
    env_path.write_text(
        "CORTEX_MAX_RESULTS=42\nPLANIFY_API_KEY=sk-test\n",
        encoding="utf-8",
    )
    resp = client.get("/api/config", params={"scope": "local"})
    body = resp.json()
    assert body["exists"] is True
    assert body["values"]["CORTEX_MAX_RESULTS"] == "42"
    assert body["values"]["PLANIFY_API_KEY"] == "sk-test"
    # Untouched known key still present (empty)
    assert body["values"]["CORTEX_MAX_SPAN"] == ""


def test_put_local_config_creates_file_and_writes_values(client, tmp_path):
    resp = client.put("/api/config", params={"scope": "local"}, json={
        "values": {"CORTEX_MAX_RESULTS": "99", "PLANIFY_API_KEY": "sk-new"}
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["needs_restart"] is True
    assert "PLANIFY_API_KEY" in body["restart_fields"]
    saved_path = tmp_path / ".cortex" / ".env"
    assert saved_path.exists()
    assert "CORTEX_MAX_RESULTS=99" in saved_path.read_text(encoding="utf-8")


def test_put_local_config_no_restart_when_only_live_fields(client, tmp_path):
    resp = client.put("/api/config", params={"scope": "local"}, json={
        "values": {"CORTEX_MAX_RESULTS": "99"}
    })
    body = resp.json()
    assert body["needs_restart"] is False
    assert body["restart_fields"] == []


def test_put_returns_400_on_type_validation_error(client):
    resp = client.put("/api/config", params={"scope": "local"}, json={
        "values": {"CORTEX_MAX_RESULTS": "not-a-number"}
    })
    assert resp.status_code == 400
    body = resp.json()
    assert any("max_results" in f["field"] or "CORTEX_MAX_RESULTS" in f["field"]
               for f in body["fields"])


def test_put_rejects_unknown_scope(client):
    resp = client.get("/api/config", params={"scope": "weird"})
    assert resp.status_code == 400 or resp.status_code == 422  # 422 if FastAPI validates Literal


def test_copy_from_global_creates_local_when_global_exists(client, tmp_path, monkeypatch):
    # Use separate home/work dirs so global and local .env are distinct files
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USERPROFILE", str(home_dir))
    monkeypatch.chdir(work_dir)

    global_env = home_dir / ".cortex" / ".env"
    global_env.parent.mkdir(parents=True)
    global_env.write_text("PLANIFY_API_KEY=sk-global\nCORTEX_MAX_RESULTS=20\n", encoding="utf-8")

    # Local doesn't exist yet
    local_env = work_dir / ".cortex" / ".env"
    assert not local_env.exists()

    # Trigger copy
    resp = client.post("/api/config/copy-from-global")
    assert resp.status_code == 200
    assert local_env.exists()
    assert "PLANIFY_API_KEY=sk-global" in local_env.read_text(encoding="utf-8")


def test_copy_from_global_returns_404_when_global_missing(client, tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USERPROFILE", str(home_dir))
    monkeypatch.chdir(work_dir)

    resp = client.post("/api/config/copy-from-global")
    assert resp.status_code == 404
