import pytest

@pytest.mark.asyncio
async def test_register_and_login(client):
    # 1. Register Student
    reg_payload = {
        "email": "pytest_student@cognipath.edu",
        "full_name": "Pytest Student",
        "password": "Password123!",
        "role": "STUDENT"
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code in (200, 201)
    data = reg_res.json()
    assert "access_token" in data
    token = data["access_token"]

    # 2. Get Current User Profile
    me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    user_data = me_res.json()
    assert user_data["email"] == "pytest_student@cognipath.edu"

    # 3. Login via OAuth2 Form Data
    login_data = {
        "username": "pytest_student@cognipath.edu",
        "password": "Password123!"
    }
    login_res = await client.post("/api/v1/auth/login", data=login_data)
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()
