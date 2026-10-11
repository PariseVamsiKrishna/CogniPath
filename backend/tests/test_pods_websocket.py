from unittest.mock import patch
import pytest
import json
from datetime import datetime, timezone, timedelta
from starlette.websockets import WebSocketDisconnect
from sqlalchemy.future import select

from app.models.models import User, Course, LearningPod, PodBlacklist
from app.core.security import get_password_hash
from app.services.pod_service import pod_manager
from tests.conftest import create_access_token_for_user

@pytest.mark.asyncio
async def test_websocket_auth_and_passcode_and_blacklist(sync_test_client, db_session):
    # Setup users
    educator = User(
        email="pod_host@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Dr. Host",
        role="EDUCATOR"
    )
    student1 = User(
        email="student1_ws@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Alice Student",
        role="STUDENT"
    )
    student2 = User(
        email="student2_ws@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Bob Blacklisted",
        role="STUDENT"
    )
    db_session.add_all([educator, student1, student2])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student1)
    await db_session.refresh(student2)

    course = Course(
        title="Distributed Systems",
        code="CS501",
        description="Course",
        educator_id=educator.id
    )
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

    # Create Pod with Bcrypt Passcode and Kshetra Meeting Code
    pod = LearningPod(
        title="Raft Consensus Pod",
        course_id=course.id,
        host_id=educator.id,
        topic="Consensus",
        passcode_hash=get_password_hash("secret123"),
        max_peers=2,
        is_active=True,
        scheduled_duration_minutes=30,
        started_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        kshetra_meeting_code="sih-raft-pod",
        status="ACTIVE"
    )
    db_session.add(pod)
    await db_session.commit()
    await db_session.refresh(pod)

    # Blacklist student2
    blacklist_entry = PodBlacklist(
        pod_id=pod.id,
        user_id=student2.id,
        reason="Disruptive conduct",
        kicked_by=educator.id
    )
    db_session.add(blacklist_entry)
    await db_session.commit()

    token_educator = create_access_token_for_user(educator.id, "EDUCATOR")
    token_student1 = create_access_token_for_user(student1.id, "STUDENT")
    token_student2 = create_access_token_for_user(student2.id, "STUDENT")

    # 1. Missing token -> 4401
    with pytest.raises(WebSocketDisconnect) as exc:
        with sync_test_client.websocket_connect(f"/api/v1/pods/ws/{pod.id}") as ws:
            ws.receive_json()
    assert exc.value.code == 4401

    # 2. Invalid token -> 4401
    with pytest.raises(WebSocketDisconnect) as exc:
        with sync_test_client.websocket_connect(f"/api/v1/pods/ws/{pod.id}?token=invalid.jwt.token") as ws:
            ws.receive_json()
    assert exc.value.code == 4401

    # 3. Non-existent room code -> 4404
    with pytest.raises(WebSocketDisconnect) as exc:
        with sync_test_client.websocket_connect(f"/api/v1/pods/ws/nonexistent-code?token={token_student1}") as ws:
            ws.receive_json()
    assert exc.value.code == 4404

    # 4. Blacklisted user -> 4403
    with pytest.raises(WebSocketDisconnect) as exc:
        with sync_test_client.websocket_connect(f"/api/v1/pods/ws/{pod.id}?token={token_student2}&passcode=secret123") as ws:
            ws.receive_json()
    assert exc.value.code == 4403

    # 5. Wrong passcode -> 4401
    with pytest.raises(WebSocketDisconnect) as exc:
        with sync_test_client.websocket_connect(f"/api/v1/pods/ws/{pod.id}?token={token_student1}&passcode=wrongpass") as ws:
            ws.receive_json()
    assert exc.value.code == 4401

    # 6. Correct join using Kshetra meeting code -> Resolves to numeric pod ID
    with sync_test_client.websocket_connect(
        f"/api/v1/pods/ws/sih-raft-pod?token={token_student1}&passcode=secret123&client_id=student1_c"
    ) as ws_student:
        # Student receives initial PEER_JOINED event
        data = ws_student.receive_json()
        assert data["type"] == "PEER_JOINED"
        assert data["user_name"] == "Alice Student"

        # Host joins using numeric ID
        with sync_test_client.websocket_connect(
            f"/api/v1/pods/ws/{pod.id}?token={token_educator}&client_id=host_c"
        ) as ws_host:
            host_join_data = ws_host.receive_json()
            assert host_join_data["type"] == "PEER_JOINED"

            # Student tries a host-only action (KICK_PARTICIPANT) -> Must be ignored
            ws_student.send_json({
                "type": "KICK_PARTICIPANT",
                "target_client_id": "host_c",
                "target_user_id": educator.id
            })

            # Host is still connected and not kicked
            assert "host_c" in pod_manager.peer_sockets.get(str(pod.id), {})

            # Host kicks student -> broadcast PARTICIPANT_KICKED
            ws_host.send_json({
                "type": "KICK_PARTICIPANT",
                "target_client_id": "student1_c",
                "target_user_id": student1.id,
                "reason": "Test Host Kick"
            })
            kicked_event = ws_host.receive_json()
            assert kicked_event["type"] == "PARTICIPANT_KICKED"
            assert kicked_event["client_id"] == "student1_c"


@pytest.mark.asyncio
async def test_kshetra_code_reuse_ended_vs_active(sync_test_client, db_session):
    educator = User(
        email="educator_reuse@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Prof. Reuse",
        role="EDUCATOR"
    )
    student = User(
        email="student_reuse@cognipath.edu",
        hashed_password=get_password_hash("Pass123!"),
        full_name="Student Reuse",
        role="STUDENT"
    )
    db_session.add_all([educator, student])
    await db_session.commit()
    await db_session.refresh(educator)
    await db_session.refresh(student)

    course = Course(
        title="Algorithms Reuse Test",
        code="CS_REUSE_999",
        description="Algorithms course",
        educator_id=educator.id
    )
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)

    # 1. Old ended pod with meeting code
    old_pod = LearningPod(
        title="Old Finished Pod",
        course_id=course.id,
        host_id=educator.id,
        topic="Dynamic Programming",
        is_active=False,
        kshetra_meeting_code="sih-reuse-code",
        status="TERMINATED_BY_HOST"
    )
    db_session.add(old_pod)
    await db_session.commit()
    await db_session.refresh(old_pod)

    # 2. New active pod with the same meeting code
    new_active_pod = LearningPod(
        title="New Active Pod",
        course_id=course.id,
        host_id=educator.id,
        topic="Greedy Algorithms",
        is_active=True,
        max_peers=5,
        scheduled_duration_minutes=45,
        started_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=45),
        kshetra_meeting_code="sih-reuse-code",
        status="ACTIVE"
    )
    db_session.add(new_active_pod)
    await db_session.commit()
    await db_session.refresh(new_active_pod)

    token_student = create_access_token_for_user(student.id, "STUDENT")

    # Connect using the meeting code -> Must resolve to new_active_pod (not old_pod)
    with sync_test_client.websocket_connect(
        f"/api/v1/pods/ws/sih-reuse-code?token={token_student}&client_id=student_reuse_c"
    ) as ws:
        data = ws.receive_json()
        assert data["type"] == "PEER_JOINED"
        assert data["user_name"] == "Student Reuse"
        assert "student_reuse_c" in pod_manager.peer_sockets.get(str(new_active_pod.id), {})
        assert "student_reuse_c" not in pod_manager.peer_sockets.get(str(old_pod.id), {})


@pytest.mark.asyncio
async def test_tutor_query_does_not_drop_socket(sync_test_client, db_session):
    educator = User(email="tutor_test@a.com", hashed_password="pw", full_name="A", role="EDUCATOR")
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)
    
    course = Course(title="Tutor test", code="T", educator_id=educator.id)
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)
    
    pod = LearningPod(title="T", course_id=course.id, host_id=educator.id, topic="Test Topic", max_peers=5, is_active=True, status="ACTIVE")
    db_session.add(pod)
    await db_session.commit()
    await db_session.refresh(pod)
    
    token = create_access_token_for_user(educator.id, "EDUCATOR")
    
    with patch("app.services.rag_service.rag_service.query_course_context") as mock_rag:
        async def mock_query(*args, **kwargs): return "Hello I am AI Tutor!"
        mock_rag.side_effect = mock_query
        
        with sync_test_client.websocket_connect(f"/api/v1/pods/ws/{pod.id}?client_id=client123&token={token}") as websocket:
            websocket.receive_json() # PEER_JOINED
            websocket.send_json({
                "type": "CHAT_MESSAGE",
                "content": "Hello @tutor, how are you?",
                "sender_name": "Test Educator"
            })
            resp1 = websocket.receive_json()
            resp2 = websocket.receive_json()
            websocket.send_json({"type": "PING", "timestamp": 12345})
            resp3 = websocket.receive_json()
            assert resp3["type"] == "PONG"

@pytest.mark.asyncio
async def test_reconnect_does_not_count_as_new_peer(sync_test_client, db_session):
    educator = User(email="recon_test@a.com", hashed_password="pw", full_name="A", role="EDUCATOR")
    db_session.add(educator)
    await db_session.commit()
    await db_session.refresh(educator)
    
    course = Course(title="Recon test", code="R", educator_id=educator.id)
    db_session.add(course)
    await db_session.commit()
    await db_session.refresh(course)
    
    pod = LearningPod(title="R", course_id=course.id, host_id=educator.id, topic="Test Topic 2", max_peers=1, is_active=True, status="ACTIVE")
    db_session.add(pod)
    await db_session.commit()
    await db_session.refresh(pod)
    
    token = create_access_token_for_user(educator.id, "EDUCATOR")
    
    with sync_test_client.websocket_connect(f"/api/v1/pods/ws/{pod.id}?client_id=client123&token={token}") as ws1:
        ws1.receive_json()
        with sync_test_client.websocket_connect(f"/api/v1/pods/ws/{pod.id}?client_id=client123&token={token}") as ws2:
            ws2.send_json({"type": "PING", "timestamp": 123})
            resp = ws2.receive_json()
            assert resp["type"] == "PONG"

