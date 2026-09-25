import json
import logging
import asyncio
from typing import Dict, Set, Any, Optional
from datetime import datetime, timezone
from fastapi import WebSocket
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.models.models import LearningPod
from app.services.rag_service import rag_service

logger = logging.getLogger("cognipath.pod")

class PodConnectionManager:
    """Manages active WebRTC signaling, chat messages, host moderation events, and session lifecycle per Learning Pod."""
    def __init__(self):
        # pod_id -> set of active WebSockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # pod_id -> peer metadata dict: client_id -> {"name": ..., "user_id": ..., "role": ...}
        self.pod_peers: Dict[int, Dict[str, Any]] = {}
        # pod_id -> client_id -> WebSocket
        self.peer_sockets: Dict[int, Dict[str, WebSocket]] = {}
        # pod_id -> host user_id
        self.pod_hosts: Dict[int, int] = {}
        # pod_id -> grace period task
        self.host_grace_timers: Dict[int, asyncio.Task] = {}
        # pod_id -> set of warned thresholds
        self.pod_warned_5m: Set[int] = set()
        self.pod_warned_1m: Set[int] = set()
        # Lifecycle monitor background task
        self.monitor_task: Optional[asyncio.Task] = None

    def ensure_monitor_running(self):
        """Starts background periodic monitor task if not already active."""
        if self.monitor_task is None or self.monitor_task.done():
            try:
                self.monitor_task = asyncio.create_task(self._lifecycle_monitor_loop())
            except RuntimeError:
                pass  # No running event loop yet

    async def _lifecycle_monitor_loop(self):
        """Periodically inspects active pods to broadcast warnings and enforce auto-termination."""
        while True:
            try:
                await asyncio.sleep(5)
                await self.check_active_pods_lifecycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in pod lifecycle monitor loop: {e}")

    async def check_active_pods_lifecycle(self):
        """Checks expiration timestamps and broadcasts countdown warnings or triggers teardown."""
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(LearningPod).where(LearningPod.is_active == True)
            )
            active_pods = result.scalars().all()

            for pod in active_pods:
                if not pod.expires_at:
                    continue

                # Ensure expires_at is timezone-aware
                exp = pod.expires_at
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)

                remaining_sec = (exp - now).total_seconds()

                # Hard termination when time has expired
                if remaining_sec <= 0:
                    logger.info(f"Pod {pod.id} reached expiration ({pod.expires_at}). Auto-terminating room.")
                    await self.teardown_pod(
                        pod_id=pod.id,
                        reason="Scheduled session duration expired. Room locked by system.",
                        status="COMPLETED"
                    )
                # 1-minute warning
                elif remaining_sec <= 60 and pod.id not in self.pod_warned_1m:
                    self.pod_warned_1m.add(pod.id)
                    await self.broadcast_to_pod(pod.id, {
                        "type": "POD_TIME_WARNING",
                        "minutes_remaining": 1,
                        "remaining_seconds": int(max(0, remaining_sec)),
                        "message": "⚠️ 1 minute remaining before this Learning Pod automatically concludes."
                    })
                # 5-minute warning
                elif remaining_sec <= 300 and pod.id not in self.pod_warned_5m:
                    self.pod_warned_5m.add(pod.id)
                    await self.broadcast_to_pod(pod.id, {
                        "type": "POD_TIME_WARNING",
                        "minutes_remaining": 5,
                        "remaining_seconds": int(max(0, remaining_sec)),
                        "message": "⏱️ 5 minutes remaining in this scheduled study session."
                    })

    async def connect(
        self,
        pod_id: int,
        websocket: WebSocket,
        client_id: str,
        user_name: str,
        user_id: Optional[int] = None,
        role: str = "STUDENT"
    ):
        await websocket.accept()
        self.ensure_monitor_running()

        if pod_id not in self.active_connections:
            self.active_connections[pod_id] = set()
            self.pod_peers[pod_id] = {}
            self.peer_sockets[pod_id] = {}

        self.active_connections[pod_id].add(websocket)
        self.pod_peers[pod_id][client_id] = {
            "name": user_name,
            "user_id": user_id,
            "role": role,
            "client_id": client_id
        }
        self.peer_sockets[pod_id][client_id] = websocket

        # Check if this user is the host
        is_host = False
        async with AsyncSessionLocal() as session:
            pod_obj = await session.get(LearningPod, pod_id)
            if pod_obj and pod_obj.host_id == user_id:
                is_host = True
                self.pod_hosts[pod_id] = user_id
                pod_obj.host_last_seen_at = datetime.now(timezone.utc)
                await session.commit()

        # If host had a pending grace period timer, cancel it
        if is_host and pod_id in self.host_grace_timers:
            timer = self.host_grace_timers.pop(pod_id)
            timer.cancel()
            logger.info(f"Host reconnected to pod {pod_id}. Cancelled grace timer.")
            await self.broadcast_to_pod(pod_id, {
                "type": "HOST_RECONNECTED",
                "pod_id": pod_id,
                "message": "Host has returned to the Learning Pod."
            })

        # Broadcast peer joined event with current participant directory
        await self.broadcast_to_pod(pod_id, {
            "type": "PEER_JOINED",
            "client_id": client_id,
            "user_name": user_name,
            "user_id": user_id,
            "role": role,
            "total_peers": len(self.active_connections[pod_id]),
            "participants": list(self.pod_peers[pod_id].values())
        })

    def disconnect(self, pod_id: int, websocket: WebSocket, client_id: str, user_id: Optional[int] = None):
        if pod_id in self.active_connections:
            self.active_connections[pod_id].discard(websocket)
            peer_info = self.pod_peers.get(pod_id, {}).pop(client_id, None)
            if client_id in self.peer_sockets.get(pod_id, {}):
                del self.peer_sockets[pod_id][client_id]

            # Check if disconnected peer is the host
            effective_user_id = user_id or (peer_info.get("user_id") if peer_info else None)
            if effective_user_id and self.pod_hosts.get(pod_id) == effective_user_id:
                # Host disconnected; initiate 180s grace period if pod still has attendees
                if len(self.active_connections.get(pod_id, set())) > 0:
                    self._schedule_host_grace_period(pod_id)

    def _schedule_host_grace_period(self, pod_id: int, grace_seconds: int = 180):
        """Starts an async countdown granting the host time to reconnect."""
        if pod_id in self.host_grace_timers:
            self.host_grace_timers[pod_id].cancel()

        async def _grace_countdown():
            try:
                logger.info(f"Host disconnected from pod {pod_id}. Starting {grace_seconds}s grace timer.")
                await self.broadcast_to_pod(pod_id, {
                    "type": "HOST_LEFT_TEMPORARILY",
                    "pod_id": pod_id,
                    "grace_period_seconds": grace_seconds,
                    "message": f"Host has temporarily disconnected. Room will automatically close in {grace_seconds // 60} minutes if host does not return."
                })
                await asyncio.sleep(grace_seconds)
                logger.info(f"Host grace period expired for pod {pod_id}. Tearing down room.")
                await self.teardown_pod(
                    pod_id=pod_id,
                    reason="Host disconnected and did not return within the grace period window.",
                    status="TERMINATED_BY_HOST"
                )
            except asyncio.CancelledError:
                logger.info(f"Host grace timer cancelled for pod {pod_id}.")
            finally:
                self.host_grace_timers.pop(pod_id, None)

        self.host_grace_timers[pod_id] = asyncio.create_task(_grace_countdown())

    async def teardown_pod(self, pod_id: int, reason: str, status: str = "COMPLETED") -> Dict[str, Any]:
        """Terminates an active pod, disconnects all attendees, and updates database records."""
        now = datetime.now(timezone.utc)
        duration_minutes = 0.0
        total_participants = 0

        # Cancel any pending host grace timer
        if pod_id in self.host_grace_timers:
            self.host_grace_timers[pod_id].cancel()
            self.host_grace_timers.pop(pod_id, None)

        # Update database record
        async with AsyncSessionLocal() as session:
            pod = await session.get(LearningPod, pod_id)
            if pod and pod.is_active:
                pod.is_active = False
                pod.status = status
                pod.ended_at = now
                if pod.started_at:
                    st = pod.started_at
                    if st.tzinfo is None:
                        st = st.replace(tzinfo=timezone.utc)
                    duration_minutes = round((now - st).total_seconds() / 60.0, 1)
                await session.commit()
            elif pod:
                duration_minutes = round((now - (pod.started_at or now)).total_seconds() / 60.0, 1)

        # Gather participant count
        sockets = list(self.active_connections.get(pod_id, set()))
        total_participants = len(self.pod_peers.get(pod_id, {}))

        # Broadcast teardown notification to all attendees
        teardown_payload = {
            "type": "EVENT_ROOM_CLOSED",
            "pod_id": pod_id,
            "status": status,
            "reason": reason,
            "ended_at": now.isoformat(),
            "duration_minutes": duration_minutes,
            "total_participants": total_participants
        }
        await self.broadcast_to_pod(pod_id, teardown_payload)

        # Cleanly close all connected sockets
        for ws in sockets:
            try:
                await ws.close(code=1000, reason=reason[:120])
            except Exception:
                pass

        # Cleanup in-memory registry
        self.active_connections.pop(pod_id, None)
        self.pod_peers.pop(pod_id, None)
        self.peer_sockets.pop(pod_id, None)
        self.pod_hosts.pop(pod_id, None)
        self.pod_warned_5m.discard(pod_id)
        self.pod_warned_1m.discard(pod_id)

        logger.info(f"Pod {pod_id} successfully torn down. Reason: {reason}")
        return {
            "pod_id": pod_id,
            "status": status,
            "reason": reason,
            "ended_at": now,
            "duration_minutes": duration_minutes,
            "total_participants": total_participants
        }

    async def send_to_client(self, pod_id: int, client_id: str, message: dict):
        """Sends direct message to a specific peer's WebSocket."""
        socket = self.peer_sockets.get(pod_id, {}).get(client_id)
        if socket:
            try:
                await socket.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send direct message to client {client_id}: {e}")

    async def kick_client(self, pod_id: int, client_id: str, reason: str = "Removed by host"):
        """Directly sends kick notice to client socket and terminates their connection."""
        socket = self.peer_sockets.get(pod_id, {}).get(client_id)
        if socket:
            try:
                await socket.send_text(json.dumps({
                    "type": "KICKED_BY_HOST",
                    "reason": reason,
                    "pod_id": pod_id
                }))
                await socket.close(code=1008, reason="Kicked by host")
            except Exception:
                pass
            self.disconnect(pod_id, socket, client_id)

    async def broadcast_to_pod(self, pod_id: int, message: dict):
        """Broadcast message to all connected peers in pod."""
        if pod_id in self.active_connections:
            raw = json.dumps(message)
            dead_sockets = set()
            for connection in self.active_connections[pod_id]:
                try:
                    await connection.send_text(raw)
                except Exception:
                    dead_sockets.add(connection)
            for dead in dead_sockets:
                self.active_connections[pod_id].discard(dead)

    async def handle_pod_message(
        self,
        pod_id: int,
        course_id: int,
        sender_name: str,
        content: str
    ):
        """Broadcasts user message and triggers AI Tutor co-pilot if summoned with @tutor."""
        # 1. Broadcast peer message
        await self.broadcast_to_pod(pod_id, {
            "type": "CHAT_MESSAGE",
            "sender_name": sender_name,
            "content": content,
            "is_ai_tutor": False
        })

        # 2. Check for @Tutor mention
        if "@tutor" in content.lower():
            query_clean = content.lower().replace("@tutor", "").strip()
            if not query_clean:
                query_clean = "Can you explain the main focus of this study pod?"

            # Generate grounded RAG response for the pod
            tutor_answer, citations, _ = await rag_service.generate_response(
                course_id=course_id,
                query=query_clean,
                target_language="en"
            )

            await self.broadcast_to_pod(pod_id, {
                "type": "CHAT_MESSAGE",
                "sender_name": "COGNIPATH AI Tutor",
                "content": tutor_answer,
                "is_ai_tutor": True,
                "citations": [c.model_dump() for c in citations]
            })

pod_manager = PodConnectionManager()
