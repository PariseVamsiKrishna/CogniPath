import asyncio
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import WebSocket
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.models.models import LearningPod, PodMessage
from app.services.rag_service import rag_service

logger = logging.getLogger("cognipath.pod")

class PodConnectionManager:
    def create_background_task(self, coro):
        task = asyncio.create_task(coro)
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)
        return task

    """Manages active WebRTC signaling, chat messages, host moderation events, and session lifecycle per Learning Pod."""
    def __init__(self):
        self.background_tasks = set()
        # room_key -> set of active WebSockets
        self.active_connections: dict[str, set[WebSocket]] = {}
        # room_key -> peer metadata dict: client_id -> {"name": ..., "user_id": ..., "role": ..., "is_host": ...}
        self.pod_peers: dict[str, dict[str, Any]] = {}
        # room_key -> client_id -> WebSocket
        self.peer_sockets: dict[str, dict[str, WebSocket]] = {}
        # room_key -> host client_id or user_id
        self.pod_hosts: dict[str, Any] = {}
        # room_key -> grace period task
        self.host_grace_timers: dict[str, asyncio.Task] = {}
        # room_key -> set of warned thresholds
        self.pod_warned_5m: set[str] = set()
        self.pod_warned_1m: set[str] = set()
        # Lifecycle monitor background task
        self.monitor_task: asyncio.Task | None = None

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
            except Exception as e:  # noqa: BLE001
                logger.error(f"Error in pod lifecycle monitor loop: {e}")

    async def check_active_pods_lifecycle(self):
        """Checks expiration timestamps and broadcasts countdown warnings or triggers teardown."""
        now = datetime.now(timezone.utc)
        five_min_ahead = now + timedelta(minutes=5)
        async with AsyncSessionLocal() as session:
            # Query active pods expiring within 5 minutes or already expired
            result = await session.execute(
                select(LearningPod).where(
                    LearningPod.is_active,
                    LearningPod.expires_at <= five_min_ahead
                )
            )
            active_pods = result.scalars().all()

            # Host heartbeat check for active connections
            for room_key, last_seen in list(self.pod_hosts.items()):
                if isinstance(last_seen, datetime):
                    ls = last_seen if last_seen.tzinfo else last_seen.replace(tzinfo=timezone.utc)
                    if (now - ls).total_seconds() > 180 and room_key not in self.host_grace_timers and len(self.active_connections.get(room_key, set())) > 0:
                        self._schedule_host_grace_period(room_key)

            for pod in active_pods:
                if not pod.expires_at:
                    continue

                pod_key = str(pod.id)
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
                elif remaining_sec <= 60 and pod_key not in self.pod_warned_1m:
                    self.pod_warned_1m.add(pod_key)
                    await self.broadcast_to_pod(pod_key, {
                        "type": "POD_TIME_WARNING",
                        "minutes_remaining": 1,
                        "remaining_seconds": int(max(0, remaining_sec)),
                        "message": "⚠️ 1 minute remaining before this Learning Pod automatically concludes."
                    })
                # 5-minute warning
                elif remaining_sec <= 300 and pod_key not in self.pod_warned_5m:
                    self.pod_warned_5m.add(pod_key)
                    await self.broadcast_to_pod(pod_key, {
                        "type": "POD_TIME_WARNING",
                        "minutes_remaining": 5,
                        "remaining_seconds": int(max(0, remaining_sec)),
                        "message": "⏱️ 5 minutes remaining in this scheduled study session."
                    })

    async def connect(
        self,
        pod_id: Any,
        websocket: WebSocket,
        client_id: str,
        user_name: str,
        user_id: int | None = None,
        role: str = "STUDENT",
        is_creator: bool = False
    ):
        from starlette.websockets import WebSocketState
        if websocket.client_state != WebSocketState.CONNECTED:
            await websocket.accept()
        self.ensure_monitor_running()

        room_key = str(pod_id)

        if room_key not in self.active_connections:
            self.active_connections[room_key] = set()
            self.pod_peers[room_key] = {}
            self.peer_sockets[room_key] = {}

        # If client_id already exists in peer_sockets[room_key], close the old socket and remove it from active_connections
        was_reconnect = False
        if client_id in self.peer_sockets.get(room_key, {}):
            old_ws = self.peer_sockets[room_key][client_id]
            if old_ws != websocket:
                was_reconnect = True
                self.active_connections.get(room_key, set()).discard(old_ws)
                try:
                    await old_ws.close(code=1000, reason="Replaced by new connection")
                except Exception:  # noqa: BLE001
                    pass

        self.active_connections[room_key].add(websocket)
        self.peer_sockets[room_key][client_id] = websocket

        # Determine host status
        is_host = False
        parsed_pod_id = int(room_key) if room_key.isdigit() else None
        if parsed_pod_id:
            async with AsyncSessionLocal() as session:
                pod_obj = await session.get(LearningPod, parsed_pod_id)
                if pod_obj and pod_obj.host_id == user_id:
                    is_host = True
                    self.pod_hosts[room_key] = client_id
                    pod_obj.host_last_seen_at = datetime.now(timezone.utc)
                    await session.commit()

        if not is_host:
            if room_key not in self.pod_hosts or not self.pod_hosts[room_key]:
                if is_creator or role == "EDUCATOR" or len(self.active_connections[room_key]) == 1:
                    is_host = True
                    self.pod_hosts[room_key] = client_id
            elif self.pod_hosts.get(room_key) == client_id or (user_id and self.pod_hosts.get(room_key) == user_id):
                is_host = True

        self.pod_peers[room_key][client_id] = {
            "name": user_name,
            "user_id": user_id,
            "role": role,
            "client_id": client_id,
            "is_host": is_host,
            "audio_on": True,
            "video_on": True,
            "hand_raised": False
        }

        # If host had a pending grace period timer, cancel it
        if is_host and room_key in self.host_grace_timers:
            timer = self.host_grace_timers.pop(room_key)
            if timer is not asyncio.current_task():
                timer.cancel()
            logger.info(f"Host reconnected to pod {room_key}. Cancelled grace timer.")
            await self.broadcast_to_pod(room_key, {
                "type": "HOST_RECONNECTED",
                "pod_id": room_key,
                "message": "Host has returned to the Learning Pod."
            })

        # Broadcast peer joined event with current participant directory
        if not was_reconnect:
            await self.broadcast_to_pod(room_key, {
                "type": "PEER_JOINED",
                "client_id": client_id,
                "user_name": user_name,
                "user_id": user_id,
                "role": role,
                "is_host": is_host,
                "host_client_id": self.pod_hosts.get(room_key),
                "total_peers": len(self.active_connections[room_key]),
                "participants": list(self.pod_peers[room_key].values())
            })

    def disconnect(self, pod_id: Any, websocket: WebSocket, client_id: str, user_id: int | None = None):
        room_key = str(pod_id)
        current = self.peer_sockets.get(room_key, {}).get(client_id)
        if current is not None and current is not websocket:
            if room_key in self.active_connections:
                self.active_connections[room_key].discard(websocket)
            return

        if room_key in self.active_connections:
            if websocket not in self.active_connections[room_key] and client_id not in self.pod_peers.get(room_key, {}):
                return  # Already disconnected
            self.active_connections[room_key].discard(websocket)
            peer_info = self.pod_peers.get(room_key, {}).pop(client_id, None)
            if client_id in self.peer_sockets.get(room_key, {}):
                if self.peer_sockets[room_key][client_id] == websocket:
                    del self.peer_sockets[room_key][client_id]

            if peer_info:
                # Broadcast PEER_LEFT to remaining peers
                self.create_background_task(self.broadcast_to_pod(room_key, {
                    "type": "PEER_LEFT",
                    "client_id": client_id,
                    "user_name": peer_info.get("name") if peer_info else "Participant",
                    "total_peers": len(self.active_connections.get(room_key, set())),
                    "participants": list(self.pod_peers.get(room_key, {}).values())
                }))

            # Check if disconnected peer is the host
            effective_user_id = user_id or (peer_info.get("user_id") if peer_info else None)
            is_host_leaving = (
                (effective_user_id and self.pod_hosts.get(room_key) == effective_user_id) or
                (self.pod_hosts.get(room_key) == client_id)
            )
            if is_host_leaving:
                # Host disconnected; initiate 180s grace period if pod still has attendees
                if len(self.active_connections.get(room_key, set())) > 0:
                    self._schedule_host_grace_period(room_key)

    def _schedule_host_grace_period(self, pod_id: Any, grace_seconds: int = 180):
        """Starts an async countdown granting the host time to reconnect."""
        room_key = str(pod_id)
        if room_key in self.host_grace_timers:
            timer = self.host_grace_timers[room_key]
            if timer is not asyncio.current_task():
                timer.cancel()

        async def _grace_countdown():
            try:
                logger.info(f"Host disconnected from pod {room_key}. Starting {grace_seconds}s grace timer.")
                await self.broadcast_to_pod(room_key, {
                    "type": "HOST_LEFT_TEMPORARILY",
                    "pod_id": room_key,
                    "grace_period_seconds": grace_seconds,
                    "message": f"Host has temporarily disconnected. Room will automatically close in {grace_seconds // 60} minutes if host does not return."
                })
                await asyncio.sleep(grace_seconds)
                logger.info(f"Host grace period expired for pod {room_key}. Tearing down room.")
                await self.teardown_pod(
                    pod_id=room_key,
                    reason="Host disconnected and did not return within the grace period window.",
                    status="TERMINATED_BY_HOST"
                )
            except asyncio.CancelledError:
                logger.info(f"Host grace timer cancelled for pod {room_key}.")
            finally:
                self.host_grace_timers.pop(room_key, None)

        self.host_grace_timers[room_key] = asyncio.create_task(_grace_countdown())

    async def teardown_pod(self, pod_id: Any, reason: str, status: str = "COMPLETED") -> dict[str, Any]:
        """Terminates an active pod, disconnects all attendees, and updates database records."""
        room_key = str(pod_id)
        now = datetime.now(timezone.utc)
        duration_minutes = 0.0

        # Cancel any pending host grace timer (avoid self-cancellation if called from grace countdown)
        if room_key in self.host_grace_timers:
            timer = self.host_grace_timers[room_key]
            if timer is not asyncio.current_task():
                timer.cancel()
            self.host_grace_timers.pop(room_key, None)

        # Update database record if integer pod_id
        parsed_pod_id = int(room_key) if room_key.isdigit() else None
        if parsed_pod_id:
            async with AsyncSessionLocal() as session:
                pod = await session.get(LearningPod, parsed_pod_id)
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
        sockets = list(self.active_connections.get(room_key, set()))
        total_participants = len(self.pod_peers.get(room_key, {}))

        # Broadcast teardown notification to all attendees
        teardown_payload = {
            "type": "EVENT_ROOM_CLOSED",
            "pod_id": room_key,
            "status": status,
            "reason": reason,
            "ended_at": now.isoformat(),
            "duration_minutes": duration_minutes,
            "total_participants": total_participants
        }
        await self.broadcast_to_pod(room_key, teardown_payload)

        # Cleanly close all connected sockets
        for ws in sockets:
            try:
                await ws.close(code=1000, reason=reason[:120])
            except Exception:  # noqa: BLE001
                pass

        # Cleanup in-memory registry
        self.active_connections.pop(room_key, None)
        self.pod_peers.pop(room_key, None)
        self.peer_sockets.pop(room_key, None)
        self.pod_hosts.pop(room_key, None)
        self.pod_warned_5m.discard(room_key)
        self.pod_warned_1m.discard(room_key)

        logger.info(f"Pod {room_key} successfully torn down. Reason: {reason}")
        return {
            "pod_id": room_key,
            "status": status,
            "reason": reason,
            "ended_at": now,
            "duration_minutes": duration_minutes,
            "total_participants": total_participants
        }

    async def send_to_client(self, pod_id: Any, client_id: str, message: dict):
        """Sends direct message to a specific peer's WebSocket."""
        room_key = str(pod_id)
        socket = self.peer_sockets.get(room_key, {}).get(client_id)
        if socket:
            try:
                await socket.send_text(json.dumps(message))
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Failed to send direct message to client {client_id}: {e}")

    async def kick_client(self, pod_id: Any, client_id: str, reason: str = "Removed by host"):
        """Directly sends kick notice to client socket and terminates their connection."""
        room_key = str(pod_id)
        socket = self.peer_sockets.get(room_key, {}).get(client_id)
        if socket:
            try:
                await socket.send_text(json.dumps({
                    "type": "KICKED_BY_HOST",
                    "reason": reason,
                    "pod_id": room_key
                }))
                await socket.close(code=1008, reason="Kicked by host")
            except Exception:  # noqa: BLE001
                pass
            self.disconnect(room_key, socket, client_id)

    async def broadcast_to_pod(self, pod_id: Any, message: dict):
        """Broadcast message to all connected peers in pod."""
        room_key = str(pod_id)
        if room_key in self.active_connections:
            raw = json.dumps(message)
            dead_sockets = set()
            for connection in list(self.active_connections.get(room_key, set())):
                try:
                    await connection.send_text(raw)
                except Exception:  # noqa: BLE001
                    dead_sockets.add(connection)
            for dead in dead_sockets:
                self.active_connections[room_key].discard(dead)
                dead_cids = [cid for cid, sock in list(self.peer_sockets.get(room_key, {}).items()) if sock == dead]
                for cid in dead_cids:
                    self.peer_sockets.get(room_key, {}).pop(cid, None)
                    self.pod_peers.get(room_key, {}).pop(cid, None)

    async def handle_pod_message(
        self,
        pod_id: Any,
        course_id: int,
        sender_name: str,
        content: str,
        user_id: int | None = None
    ):
        """Broadcasts user message and triggers AI Tutor co-pilot if summoned with @tutor."""
        room_key = str(pod_id)
        parsed_pod_id = int(room_key) if room_key.isdigit() else None

        # Persist user message
        if parsed_pod_id:
            try:
                async with AsyncSessionLocal() as session:
                    msg = PodMessage(
                        pod_id=parsed_pod_id,
                        user_id=user_id,
                        sender_name=sender_name,
                        content=content,
                        is_ai_tutor=False
                    )
                    session.add(msg)
                    await session.commit()
            except Exception as e:  # noqa: BLE001
                logger.error(f"Failed to persist pod message: {e}")

        # Broadcast peer message
        await self.broadcast_to_pod(room_key, {
            "type": "CHAT_MESSAGE",
            "sender_name": sender_name,
            "content": content,
            "is_ai_tutor": False
        })

        # Check for @tutor mention
        if "@tutor" in content.lower():
            # Preserve original casing
            query_clean = re.sub(r'(?i)@tutor', '', content).strip()
            if not query_clean:
                query_clean = "Can you explain the main focus of this study pod?"

            async def _process_tutor():
                try:
                    tutor_answer = await asyncio.wait_for(
                        rag_service.query_course_context(
                            course_id=course_id,
                            query=query_clean,
                            target_language="en"
                        ),
                        timeout=20.0
                    )
                    citations = []
                except Exception as e:  # noqa: BLE001
                    logger.error(f"Error generating AI Tutor response in pod: {e}")
                    tutor_answer = "I'm currently unable to process your question. Please try asking again in a moment."
                    citations = []

                if parsed_pod_id:
                    try:
                        async with AsyncSessionLocal() as session:
                            tutor_msg = PodMessage(
                                pod_id=parsed_pod_id,
                                user_id=None,
                                sender_name="COGNIPATH AI Tutor",
                                content=tutor_answer,
                                is_ai_tutor=True
                            )
                            session.add(tutor_msg)
                            await session.commit()
                    except Exception as e:  # noqa: BLE001
                        logger.error(f"Failed to persist tutor response: {e}")

                await self.broadcast_to_pod(room_key, {
                    "type": "CHAT_MESSAGE",
                    "sender_name": "COGNIPATH AI Tutor",
                    "content": tutor_answer,
                    "is_ai_tutor": True,
                    "citations": [c.model_dump() for c in citations] if citations else []
                })

            self.create_background_task(_process_tutor())

pod_manager = PodConnectionManager()
