def test_get_backups_empty(client):
    response = client.get("/api/backups")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
