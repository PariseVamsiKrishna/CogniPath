import json
import secrets
import logging
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import get_current_user
from app.models.models import LearningPod, PodMessage, User, PodBlacklist, EducatorPodQuota
from app.schemas.schemas import (
    PodCreate, PodResponse, PodMessageSchema,
    PodPasscodeVerifyRequest, PodPasscodeVerifyResponse,
    PodEndRequest, PodEndResponse
)
from app.services.pod_service import pod_manager

logger = logging.getLogger("cognipath.pods_api")

router = APIRouter(prefix="/pods", tags=["Native Learning Pods & Real-Time Collab"])


@router.get("", response_model=List[PodResponse])
async def list_pods(course_id: int, db: AsyncSession = Depends(get_db)):
    """List all active learning pods for a specific course with host details and duration info."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(LearningPod).where(
            LearningPod.course_id == course_id,
            LearningPod.is_active == True
        ).order_by(LearningPod.created_at.desc())
    )
    pods = result.scalars().all()

    responses = []
    for p in pods:
        host_res = await db.execute(select(User).where(User.id == p.host_id))
        host = host_res.scalars().first()

        rem_sec = None
        if p.expires_at:
            exp = p.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            rem_sec = max(0, int((exp - now).total_seconds()))

        kshetra_code = p.kshetra_meeting_code
        if not kshetra_code or len(kshetra_code.strip()) == 0:
            kshetra_code = f"sih-pod-{p.id}"

        responses.append(PodResponse(
            id=p.id,
            title=p.title,
            course_id=p.course_id,
            host_id=p.host_id,
            topic=p.topic,
            agenda=p.agenda,
            has_passcode=bool(p.passcode_hash and len(p.passcode_hash.strip()) > 0),
            host_name=host.full_name if host else "Educator",
            is_active=p.is_active,
            max_peers=p.max_peers,
            scheduled_duration_minutes=p.scheduled_duration_minutes or 45,
            started_at=p.started_at,
            expires_at=p.expires_at,
            ended_at=p.ended_at,
            status=p.status or ("ACTIVE" if p.is_active else "COMPLETED"),
            remaining_seconds=rem_sec,
            kshetra_meeting_code=kshetra_code,
            created_at=p.created_at
        ))
    return responses


@router.post("", response_model=PodResponse, status_code=status.HTTP_201_CREATED)
async def create_pod(
    pod_in: PodCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new native learning pod with agenda, passcode, and educator quota checks."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    week_start_str = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")

    # Enforce quota for educators
    if current_user.role == "EDUCATOR":
        quota_res = await db.execute(
            select(EducatorPodQuota).where(
                EducatorPodQuota.educator_id == current_user.id,
                EducatorPodQuota.day_date == today_str
            )
        )
        quota = quota_res.scalars().first()

        if not quota:
            quota = EducatorPodQuota(
                educator_id=current_user.id,
                day_date=today_str,
                week_start_date=week_start_str,
                daily_created=0,
                weekly_created=0
            )
            db.add(quota)
            await db.commit()
            await db.refresh(quota)

        # Quota checks: 3 per day, 12 per week
        if quota.daily_created >= 3:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Educator quota limit exceeded: Maximum 3 active pods allowed per day."
            )
        if quota.weekly_created >= 12:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Educator quota limit exceeded: Maximum 12 active pods allowed per week."
            )

        quota.daily_created += 1
        quota.weekly_created += 1
        await db.commit()

    duration_mins = pod_in.scheduled_duration_minutes or 45
    started_at = now
    expires_at = now + timedelta(minutes=duration_mins)

    # Assign or generate clean Live Kshetra meeting code
    if pod_in.kshetra_meeting_code and pod_in.kshetra_meeting_code.strip():
        kshetra_code = pod_in.kshetra_meeting_code.strip().replace(" ", "-").lower()
    else:
        p1 = secrets.token_hex(2)
        p2 = secrets.token_hex(2)
        kshetra_code = f"sih-{p1}-{p2}"

    pod = LearningPod(
        title=pod_in.title,
        course_id=pod_in.course_id,
        host_id=current_user.id,
        topic=pod_in.topic,
        agenda=pod_in.agenda,
        passcode_hash=pod_in.passcode.strip() if pod_in.passcode else None,
        max_peers=pod_in.max_peers,
        is_active=True,
        scheduled_duration_minutes=duration_mins,
        started_at=started_at,
        expires_at=expires_at,
        kshetra_meeting_code=kshetra_code,
        status="ACTIVE"
    )
    db.add(pod)
    await db.commit()
    await db.refresh(pod)

    return PodResponse(
        id=pod.id,
        title=pod.title,
        course_id=pod.course_id,
        host_id=pod.host_id,
        topic=pod.topic,
        agenda=pod.agenda,
        has_passcode=bool(pod.passcode_hash),
        host_name=current_user.full_name,
        is_active=pod.is_active,
        max_peers=pod.max_peers,
        scheduled_duration_minutes=pod.scheduled_duration_minutes or 45,
        started_at=pod.started_at,
        expires_at=pod.expires_at,
        ended_at=pod.ended_at,
        status=pod.status or "ACTIVE",
        remaining_seconds=duration_mins * 60,
        kshetra_meeting_code=pod.kshetra_meeting_code,
        created_at=pod.created_at
    )


@router.get("/educator/quota")
async def get_educator_quota(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve educator's remaining pod creation quota for today and this week."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    week_start_str = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")

    quota_res = await db.execute(
        select(EducatorPodQuota).where(
            EducatorPodQuota.educator_id == current_user.id,
            EducatorPodQuota.day_date == today_str
        )
    )
    quota = quota_res.scalars().first()

    daily_used = quota.daily_created if quota else 0
    weekly_used = quota.weekly_created if quota else 0

    return {
        "daily_created": daily_used,
        "daily_limit": 3,
        "daily_remaining": max(0, 3 - daily_used),
        "weekly_created": weekly_used,
        "weekly_limit": 12,
        "weekly_remaining": max(0, 12 - weekly_used)
    }


@router.get("/kshetra-embed/{code}", response_class=HTMLResponse)
async def get_kshetra_embed(code: str):
    """
    Live Kshetra Embedded Video Conferencing Proxy.
    Fetches https://live-kshetra.vercel.app/join/{code}, rewrites asset references to absolute,
    and strips X-Frame-Options to seamlessly mount Live Kshetra inside CogniPath Learning Pods.
    """
    clean_code = code.strip().replace(" ", "-").lower()
    target_url = f"https://live-kshetra.vercel.app/join/{clean_code}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(target_url, headers=headers)
            html = resp.text

            # Rewrite relative asset paths to absolute Live Kshetra production assets
            html = html.replace('src="/assets/', 'src="https://live-kshetra.vercel.app/assets/')
            html = html.replace('href="/assets/', 'href="https://live-kshetra.vercel.app/assets/')

            # Inject client-side route bootstrap script
            injection = f"""
            <script>
              try {{
                if (window.location.pathname !== '/join/{clean_code}') {{
                  window.history.replaceState(null, '', '/join/{clean_code}');
                }}
              }} catch (err) {{
                console.warn('[LiveKshetra] Route initialization warning:', err);
              }}
            </script>
            """
            html = html.replace('<div id="root"></div>', f'{injection}<div id="root"></div>')

            custom_headers = {
                "Access-Control-Allow-Origin": "*",
                "Permissions-Policy": "camera=*, microphone=*, display-capture=*, clipboard-write=*"
            }
            return HTMLResponse(content=html, status_code=200, headers=custom_headers)
    except Exception as e:
        logger.error(f"Live Kshetra proxy error: {e}")
        fallback_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <style>
            body {{
              background-color: #0A0D1C;
              color: #ECEDF7;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
              padding: 20px;
            }}
            .card {{
              background: #12162B;
              border: 1px solid #262C4C;
              border-radius: 20px;
              padding: 32px;
              max-width: 480px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }}
            .badge {{
              background: rgba(255, 153, 51, 0.15);
              color: #FF9933;
              border: 1px solid rgba(255, 153, 51, 0.3);
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }}
            .title {{ font-size: 20px; font-weight: 800; margin: 16px 0 8px 0; color: #ECEDF7; }}
            .code-box {{
              background: #171C36;
              border: 1px solid #8B7CFF;
              border-radius: 12px;
              padding: 10px 16px;
              font-family: monospace;
              font-size: 16px;
              font-weight: bold;
              color: #5FE3B0;
              letter-spacing: 0.1em;
              margin: 16px 0;
            }}
            .btn {{
              background: linear-gradient(135deg, #FF9933, #FF6F9C);
              color: #0A0D1C;
              text-decoration: none;
              font-weight: 700;
              font-size: 14px;
              padding: 12px 24px;
              border-radius: 12px;
              display: inline-block;
              box-shadow: 0 4px 14px rgba(255, 153, 51, 0.4);
            }}
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Live Kshetra Video Pod</span>
            <h2 class="title">Join Learning Session</h2>
            <p style="color: #8A90B4; font-size: 13px;">Zero-Trust Encrypted Real-Time Video Collaboration</p>
            <div class="code-box">{clean_code}</div>
            <a class="btn" href="https://live-kshetra.vercel.app/join/{clean_code}" target="_blank" rel="noopener noreferrer">
              Launch Live Kshetra Room ↗
            </a>
          </div>
        </body>
        </html>
        """
        return HTMLResponse(content=fallback_html, status_code=200)


@router.get("/kshetra-meta/{code}")
async def get_kshetra_meta(code: str):
    """Returns direct join URL, embed URL, and meeting code for any Live Kshetra room."""
    clean_code = code.strip().replace(" ", "-").lower()
    return {
        "meeting_code": clean_code,
        "join_url": f"https://live-kshetra.vercel.app/join/{clean_code}",
        "embed_url": f"/api/v1/pods/kshetra-embed/{clean_code}"
    }


@router.post("/{pod_id}/verify-passcode", response_model=PodPasscodeVerifyResponse)
async def verify_pod_passcode(
    pod_id: int,
    req: PodPasscodeVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verifies pod passcode and checks blacklist status before permitting WebRTC signaling."""
    # 1. Check blacklist
    bl_res = await db.execute(
        select(PodBlacklist).where(
            PodBlacklist.pod_id == pod_id,
            PodBlacklist.user_id == current_user.id
        )
    )
    if bl_res.scalars().first():
        return PodPasscodeVerifyResponse(
            verified=False,
            is_blacklisted=True,
            message="You have been permanently removed and blacklisted from this learning pod."
        )

    # 2. Check pod
    pod_res = await db.execute(select(LearningPod).where(LearningPod.id == pod_id))
    pod = pod_res.scalars().first()
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")

    # If pod has no passcode or user is host
    if not pod.passcode_hash or current_user.id == pod.host_id:
        return PodPasscodeVerifyResponse(
            verified=True,
            is_blacklisted=False,
            message="Access authorized"
        )

    # Verify matching passcode
    if req.passcode.strip() == pod.passcode_hash.strip():
        return PodPasscodeVerifyResponse(
            verified=True,
            is_blacklisted=False,
            message="Passcode verified successfully"
        )

    return PodPasscodeVerifyResponse(
        verified=False,
        is_blacklisted=False,
        message="Incorrect pod passcode. Please request the passkey from the host."
    )


@router.get("/{pod_id}", response_model=PodResponse)
async def get_pod(pod_id: int, db: AsyncSession = Depends(get_db)):
    """Get single pod details with synchronized remaining duration."""
    result = await db.execute(select(LearningPod).where(LearningPod.id == pod_id))
    pod = result.scalars().first()
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")

    host_res = await db.execute(select(User).where(User.id == pod.host_id))
    host = host_res.scalars().first()

    now = datetime.now(timezone.utc)
    rem_sec = None
    if pod.expires_at:
        exp = pod.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        rem_sec = max(0, int((exp - now).total_seconds()))

    return PodResponse(
        id=pod.id,
        title=pod.title,
        course_id=pod.course_id,
        host_id=pod.host_id,
        topic=pod.topic,
        agenda=pod.agenda,
        has_passcode=bool(pod.passcode_hash and len(pod.passcode_hash.strip()) > 0),
        host_name=host.full_name if host else "Educator",
        is_active=pod.is_active,
        max_peers=pod.max_peers,
        scheduled_duration_minutes=pod.scheduled_duration_minutes or 45,
        started_at=pod.started_at,
        expires_at=pod.expires_at,
        ended_at=pod.ended_at,
        status=pod.status or ("ACTIVE" if pod.is_active else "COMPLETED"),
        remaining_seconds=rem_sec,
        created_at=pod.created_at
    )


@router.post("/{pod_id}/end", response_model=PodEndResponse)
async def end_pod_for_everyone(
    pod_id: int,
    req: Optional[PodEndRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Immediately terminate pod session for all participants (restricted to host or educator)."""
    pod = await db.get(LearningPod, pod_id)
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")

    if pod.host_id != current_user.id and current_user.role != "EDUCATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the pod host or an educator can end this meeting for everyone."
        )

    reason = req.reason if req and req.reason else "Session ended by meeting host"
    result = await pod_manager.teardown_pod(
        pod_id=pod_id,
        reason=reason,
        status="TERMINATED_BY_HOST"
    )

    return PodEndResponse(
        pod_id=result["pod_id"],
        status=result["status"],
        reason=result["reason"],
        ended_at=result["ended_at"],
        duration_minutes=result["duration_minutes"],
        total_participants=result["total_participants"]
    )


@router.get("/{pod_id}/messages", response_model=List[PodMessageSchema])
async def get_pod_messages(pod_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve message history for a learning pod."""
    result = await db.execute(
        select(PodMessage).where(PodMessage.pod_id == pod_id).order_by(PodMessage.created_at.asc())
    )
    return result.scalars().all()


# ==============================================================================
# WEBSOCKET REAL-TIME SIGNALING & MODERATION HUB
# ==============================================================================

@router.websocket("/ws/{pod_id}")
async def pod_websocket_endpoint(
    websocket: WebSocket,
    pod_id: int,
    client_id: str = "guest",
    user_name: str = "Peer",
    user_id: Optional[str] = None,
    role: str = "STUDENT"
):
    """WebSocket endpoint for WebRTC mesh signaling, live chat with @Tutor co-pilot, and host moderation."""
    parsed_user_id = None
    if user_id is not None and str(user_id).strip().isdigit():
        parsed_user_id = int(str(user_id).strip())

    # Check blacklist before admitting
    async with AsyncSessionLocal() as check_session:
        if parsed_user_id:
            bl_res = await check_session.execute(
                select(PodBlacklist).where(
                    PodBlacklist.pod_id == pod_id,
                    PodBlacklist.user_id == parsed_user_id
                )
            )
            if bl_res.scalars().first():
                await websocket.close(code=1008, reason="Blacklisted from pod")
                return

    await pod_manager.connect(
        pod_id=pod_id,
        websocket=websocket,
        client_id=client_id,
        user_name=user_name,
        user_id=parsed_user_id,
        role=role
    )

    course_id = 1
    host_id = None
    async with AsyncSessionLocal() as session:
        pod_res = await session.execute(select(LearningPod).where(LearningPod.id == pod_id))
        pod_obj = pod_res.scalars().first()
        if pod_obj:
            course_id = pod_obj.course_id
            host_id = pod_obj.host_id

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            msg_type = data.get("type")

            if msg_type == "CHAT_MESSAGE":
                content = data.get("content", "")
                sender = data.get("sender_name", user_name)

                # Persist message
                async with AsyncSessionLocal() as session:
                    db_msg = PodMessage(
                        pod_id=pod_id,
                        sender_name=sender,
                        content=content,
                        is_ai_tutor=False
                    )
                    session.add(db_msg)
                    await session.commit()

                # Dispatch chat & handle possible @Tutor query
                await pod_manager.handle_pod_message(
                    pod_id=pod_id,
                    course_id=course_id,
                    sender_name=sender,
                    content=content
                )

            elif msg_type == "KICK_PARTICIPANT":
                # Host kicks participant
                target_client_id = data.get("target_client_id")
                target_user_id = data.get("target_user_id")
                reason = data.get("reason", "Disruptive conduct")

                if target_user_id:
                    async with AsyncSessionLocal() as session:
                        bl_entry = PodBlacklist(
                            pod_id=pod_id,
                            user_id=target_user_id,
                            reason=reason,
                            kicked_by=user_id or 1
                        )
                        session.add(bl_entry)
                        await session.commit()

                if target_client_id:
                    await pod_manager.kick_client(pod_id, target_client_id, reason)
                    await pod_manager.broadcast_to_pod(pod_id, {
                        "type": "PARTICIPANT_KICKED",
                        "client_id": target_client_id,
                        "reason": reason
                    })

            elif msg_type in ["FORCE_MUTE_PARTICIPANT", "MUTE_PARTICIPANT"]:
                target_client_id = data.get("target_client_id") or data.get("targetUserId")
                reason = data.get("reason", "Muted by host")
                if target_client_id:
                    await pod_manager.send_to_client(pod_id, target_client_id, {
                        "type": "FORCE_MUTE_PARTICIPANT",
                        "host_id": parsed_user_id or client_id,
                        "reason": reason
                    })
                    await pod_manager.broadcast_to_pod(pod_id, {
                        "type": "HOST_MUTED_PEER",
                        "client_id": target_client_id
                    })

            elif msg_type == "REQUEST_UNMUTE_PERMISSION":
                sender_id = data.get("senderId") or data.get("sender_client_id") or client_id
                sender_name = data.get("senderName") or data.get("sender_name") or user_name
                await pod_manager.broadcast_to_pod(pod_id, {
                    "type": "UNMUTE_PERMISSION_REQUESTED",
                    "sender_client_id": sender_id,
                    "sender_id": sender_id,
                    "sender_name": sender_name,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            elif msg_type in ["GRANT_UNMUTE_PERMISSION", "UNMUTE_PARTICIPANT"]:
                target_client_id = data.get("target_client_id") or data.get("targetUserId")
                if target_client_id:
                    # Privacy-preserving: send invitation event to participant rather than forcing audio track on
                    await pod_manager.send_to_client(pod_id, target_client_id, {
                        "type": "EVENT_UNMUTE_PERMISSION_GRANTED",
                        "host_id": parsed_user_id or client_id,
                        "host_name": user_name
                    })

            elif msg_type == "DENY_UNMUTE_PERMISSION":
                target_client_id = data.get("target_client_id") or data.get("targetUserId")
                reason = data.get("reason", "Host denied unmute request")
                if target_client_id:
                    await pod_manager.send_to_client(pod_id, target_client_id, {
                        "type": "EVENT_UNMUTE_PERMISSION_DENIED",
                        "reason": reason
                    })

            elif msg_type == "MUTE_ALL":
                for cid, sock in list(pod_manager.peer_sockets.get(pod_id, {}).items()):
                    if cid != client_id:
                        try:
                            await sock.send_text(json.dumps({
                                "type": "FORCE_MUTE_PARTICIPANT",
                                "host_id": parsed_user_id or client_id,
                                "reason": "All participants muted by host"
                            }))
                        except Exception:
                            pass
                await pod_manager.broadcast_to_pod(pod_id, {
                    "type": "ALL_PEERS_MUTED",
                    "muted_by": client_id
                })

            elif msg_type == "MEDIA_STATE_CHANGE":
                await pod_manager.broadcast_to_pod(pod_id, data)

            elif msg_type == "DISABLE_VIDEO":
                target_client_id = data.get("target_client_id")
                if target_client_id:
                    await pod_manager.send_to_client(pod_id, target_client_id, {"type": "REMOTE_DISABLE_VIDEO"})
                    await pod_manager.broadcast_to_pod(pod_id, {
                        "type": "HOST_DISABLED_VIDEO_PEER",
                        "client_id": target_client_id
                    })

            elif msg_type in ["SIGNAL_OFFER", "SIGNAL_ANSWER", "SIGNAL_ICE", "WHITEBOARD_DRAW", "WHITEBOARD_CLEAR"]:
                # Relay WebRTC signaling frames or whiteboard strokes to peers
                await pod_manager.broadcast_to_pod(pod_id, data)

            elif msg_type == "END_POD_FOR_ALL":
                if parsed_user_id and (parsed_user_id == host_id or role == "EDUCATOR"):
                    await pod_manager.teardown_pod(
                        pod_id=pod_id,
                        reason=data.get("reason", "Meeting host ended the session for everyone."),
                        status="TERMINATED_BY_HOST"
                    )

            elif msg_type == "HOST_HEARTBEAT":
                async with AsyncSessionLocal() as session:
                    p = await session.get(LearningPod, pod_id)
                    if p and p.host_id == user_id:
                        p.host_last_seen_at = datetime.now(timezone.utc)
                        await session.commit()

            elif msg_type == "PING":
                # Heartbeat keepalive response for Cloudflare/Render/Koyeb idle timeouts
                await websocket.send_text(json.dumps({
                    "type": "PONG",
                    "client_id": client_id,
                    "timestamp": data.get("timestamp")
                }))

    except WebSocketDisconnect:
        pod_manager.disconnect(pod_id, websocket, client_id, user_id)
        await pod_manager.broadcast_to_pod(pod_id, {
            "type": "PEER_LEFT",
            "client_id": client_id,
            "user_name": user_name
        })
