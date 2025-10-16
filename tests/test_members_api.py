"""Integration tests for member API endpoints."""

import pytest

from backend.models import Business, ClassCourse, Group


@pytest.fixture
def business(db_session):
    business = Business(name="Test Business")
    db_session.add(business)
    db_session.commit()
    db_session.refresh(business)
    return business


@pytest.fixture
def class_and_group(db_session, business):
    class_course = ClassCourse(business_id=business.id, name="Pilates Intro")
    db_session.add(class_course)
    db_session.commit()
    db_session.refresh(class_course)

    group = Group(class_id=class_course.id, name="Morning Cohort")
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)

    return class_course, group


def test_list_members_initially_empty(client):
    response = client.get("/api/members")
    payload = response.json()

    assert response.status_code == 200
    assert payload["data"] == []
    assert payload["meta"]["total"] == 0


def test_create_member_success(client, business, class_and_group):
    class_course, group = class_and_group
    payload = {
        "business_id": business.id,
        "class_id": class_course.id,
        "group_id": group.id,
        "first_name": "Jordan",
        "last_name": "Smith",
        "email": "jordan.smith@example.com",
        "status": "active",
    }

    response = client.post("/api/members", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "Jordan"
    assert data["class_info"]["name"] == "Pilates Intro"
    assert data["group_info"]["name"] == "Morning Cohort"

    list_response = client.get("/api/members")
    assert list_response.status_code == 200
    assert list_response.json()["meta"]["total"] == 1


def test_update_member_status(client, business, class_and_group):
    class_course, group = class_and_group
    create_response = client.post(
        "/api/members",
        json={
            "business_id": business.id,
            "class_id": class_course.id,
            "group_id": group.id,
            "first_name": "Jamie",
            "last_name": "Lee",
            "email": "jamie.lee@example.com",
            "status": "active",
        },
    )
    member_id = create_response.json()["id"]

    status_response = client.patch(
        f"/api/members/{member_id}/status",
        json={"status": "inactive"},
    )
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "inactive"

    delete_response = client.delete(f"/api/members/{member_id}")
    assert delete_response.status_code == 204

    after_delete = client.get("/api/members")
    assert after_delete.status_code == 200
    assert after_delete.json()["meta"]["total"] == 0
