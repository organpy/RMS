PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def test_read_and_update(admin):
    org = admin.get("/api/organization").json()
    assert org["name"] == "Northside Academy" and org["currency"] == "EUR"
    r = admin.patch("/api/organization", json={"primary_color": "#2563eb", "grace_days": 3})
    assert r.json()["primary_color"] == "#2563eb" and r.json()["grace_days"] == 3
    assert admin.patch("/api/organization", json={"primary_color": "blue"}).status_code == 422


def test_logo_upload_validates_content(admin):
    bad = admin.put("/api/organization/logo", files={"file": ("x.png", b"<svg></svg>", "image/png")})
    assert bad.status_code == 400
    ok = admin.put("/api/organization/logo", files={"file": ("logo.png", PNG, "image/png")})
    assert ok.json()["has_logo"] is True
    got = admin.get("/api/organization/logo")
    assert got.headers["content-type"] == "image/png" and got.content == PNG


def test_requires_auth(client):
    assert client.get("/api/organization").status_code == 401
