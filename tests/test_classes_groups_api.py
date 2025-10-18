"""Integration tests for class and group API endpoints."""

import pytest

from backend.models import Business


@pytest.fixture
def business(db_session):
    business = Business(name="Analytics Studio")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


def test_create_and_list_classes(client, business):
    create_response = client.post(
        "/api/classes",
        json={"business_id": business.id, "name": "Strength Training"},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Strength Training"
    assert created["groups"] == []
    assert created["member_count"] == 0

    list_response = client.get("/api/classes")
    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["meta"]["total"] == 1
    assert payload["data"][0]["name"] == "Strength Training"
    assert payload["data"][0]["member_count"] == 0


def test_group_lifecycle(client, business):
    class_response = client.post(
        "/api/classes",
        json={"business_id": business.id, "name": "Yoga Basics"},
    )
    class_id = class_response.json()["id"]

    group_response = client.post(
        "/api/groups",
        json={"class_id": class_id, "name": "Evening Group"},
    )
    assert group_response.status_code == 201
    group_id = group_response.json()["id"]

    list_groups = client.get("/api/groups")
    assert list_groups.status_code == 200
    groups_payload = list_groups.json()
    assert groups_payload["meta"]["total"] == 1

    member_response = client.post(
        "/api/members",
        json={
            "business_id": business.id,
            "class_id": class_id,
            "group_id": group_id,
            "first_name": "Alex",
            "last_name": "Morgan",
            "status": "active",
        },
    )
    member_id = member_response.json()["id"]

    group_members = client.get(f"/api/groups/{group_id}/members")
    assert group_members.status_code == 200
    member_payload = group_members.json()
    assert member_payload["meta"]["total"] == 1
    assert member_payload["data"][0]["first_name"] == "Alex"

    classes_after_member = client.get("/api/classes")
    class_payload = classes_after_member.json()
    assert class_payload["data"][0]["member_count"] == 1
    assert class_payload["data"][0]["groups"][0]["member_count"] == 1

    delete_group = client.delete(f"/api/groups/{group_id}")
    assert delete_group.status_code == 204

    members_after_delete = client.get("/api/members")
    assert members_after_delete.status_code == 200
    members_data = members_after_delete.json()
    assert members_data["meta"]["total"] == 0

