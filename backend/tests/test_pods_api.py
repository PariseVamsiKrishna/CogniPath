import pytest

@pytest.mark.asyncio
async def test_pod_creation_and_quota(client):
    # 1. Register Educator
    reg_res = await client.post("/api/v1/auth/register", json={
        "email": "educator_pytest@cognipath.edu",
        "full_name": "Prof. Test Educator",
        "password": "Password123!",
        "role": "EDUCATOR"
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Pod 1
    pod_payload = {
        "title": "Pytest Pod 1",
        "course_id": 1,
        "topic": "Algorithms",
        "agenda": "Reviewing sorting invariants",
        "max_peers": 6,
        "scheduled_duration_minutes": 30
    }
    create_res = await client.post("/api/v1/pods", json=pod_payload, headers=headers)
    assert create_res.status_code == 201
    pod_data = create_res.json()
    assert pod_data["title"] == "Pytest Pod 1"
    assert pod_data["max_peers"] <= 6

    # 3. Check Educator Quota
    quota_res = await client.get("/api/v1/pods/educator/quota", headers=headers)
    assert quota_res.status_code == 200
    q_data = quota_res.json()
    assert q_data["daily_created"] >= 1
