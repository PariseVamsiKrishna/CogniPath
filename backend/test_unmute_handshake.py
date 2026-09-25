import asyncio
import json
from app.services.pod_service import pod_manager

class MockWebSocket:
    def __init__(self, client_id: str):
        self.client_id = client_id
        self.sent_messages = []
        self.accepted = False
        self.closed = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, text: str):
        data = json.loads(text)
        self.sent_messages.append(data)

    async def close(self, code=1000, reason=""):
        self.closed = True

async def run_handshake_test():
    pod_id = 999
    host_ws = MockWebSocket("host_client")
    student_ws = MockWebSocket("student_client")

    print("[STEP 1] Connecting Host and Student to Pod #999...")
    await pod_manager.connect(
        pod_id=pod_id,
        websocket=host_ws,
        client_id="host_client",
        user_name="Prof. Ramanujan",
        user_id=1,
        role="EDUCATOR"
    )
    assert host_ws.accepted is True
    assert len(host_ws.sent_messages) == 1
    assert host_ws.sent_messages[-1]["type"] == "PEER_JOINED"
    print(" -> Host joined room successfully.")

    await pod_manager.connect(
        pod_id=pod_id,
        websocket=student_ws,
        client_id="student_client",
        user_name="Alex Kumar",
        user_id=2,
        role="STUDENT"
    )
    assert student_ws.accepted is True
    assert host_ws.sent_messages[-1]["type"] == "PEER_JOINED"
    assert host_ws.sent_messages[-1]["client_id"] == "student_client"
    print(" -> Student joined room; Host received join notification.")

    print("\n[STEP 2] Host Force-Mutes Student...")
    await pod_manager.send_to_client(pod_id, "student_client", {
        "type": "FORCE_MUTE_PARTICIPANT",
        "host_id": 1,
        "reason": "Host muted student for lecture section"
    })
    await pod_manager.broadcast_to_pod(pod_id, {
        "type": "HOST_MUTED_PEER",
        "client_id": "student_client"
    })

    student_mute = student_ws.sent_messages[-2]
    assert student_mute["type"] == "FORCE_MUTE_PARTICIPANT"
    assert student_mute["host_id"] == 1
    print(" -> [PASS] Student received FORCE_MUTE_PARTICIPANT signal.")

    host_broadcast = host_ws.sent_messages[-1]
    assert host_broadcast["type"] == "HOST_MUTED_PEER"
    assert host_broadcast["client_id"] == "student_client"
    print(" -> [PASS] Host received broadcast HOST_MUTED_PEER.")

    print("\n[STEP 3] Student Requests Unmute Permission from Host...")
    await pod_manager.broadcast_to_pod(pod_id, {
        "type": "UNMUTE_PERMISSION_REQUESTED",
        "sender_client_id": "student_client",
        "sender_id": "student_client",
        "sender_name": "Alex Kumar",
        "timestamp": "2026-09-20T16:15:00Z"
    })

    host_request = host_ws.sent_messages[-1]
    assert host_request["type"] == "UNMUTE_PERMISSION_REQUESTED"
    assert host_request["sender_client_id"] == "student_client"
    assert host_request["sender_name"] == "Alex Kumar"
    print(" -> [PASS] Host moderation tray received UNMUTE_PERMISSION_REQUESTED.")

    print("\n[STEP 4] Host Grants Permission (Sends Invitation, NOT Forcible Unmute)...")
    await pod_manager.send_to_client(pod_id, "student_client", {
        "type": "EVENT_UNMUTE_PERMISSION_GRANTED",
        "host_id": 1,
        "host_name": "Prof. Ramanujan"
    })

    student_grant = student_ws.sent_messages[-1]
    assert student_grant["type"] == "EVENT_UNMUTE_PERMISSION_GRANTED"
    assert student_grant["host_name"] == "Prof. Ramanujan"
    print(" -> [PASS] Student received EVENT_UNMUTE_PERMISSION_GRANTED (Consent Modal Triggered).")

    print("\n[STEP 5] Host Denies Unmute Request Scenario...")
    await pod_manager.send_to_client(pod_id, "student_client", {
        "type": "EVENT_UNMUTE_PERMISSION_DENIED",
        "reason": "Wait for Q&A section at end of lecture"
    })

    student_deny = student_ws.sent_messages[-1]
    assert student_deny["type"] == "EVENT_UNMUTE_PERMISSION_DENIED"
    assert student_deny["reason"] == "Wait for Q&A section at end of lecture"
    print(" -> [PASS] Student received EVENT_UNMUTE_PERMISSION_DENIED with reason.")

    pod_manager.disconnect(pod_id, host_ws, "host_client")
    pod_manager.disconnect(pod_id, student_ws, "student_client")
    print("\n==================================================================")
    print("ALL REMOTE MUTE & UNMUTE PERMISSION PROTOCOL TESTS PASSED (100%)")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(run_handshake_test())
