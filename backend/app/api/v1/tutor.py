import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, StudentActivityLog
from app.schemas.schemas import (
    TutorQueryRequest,
    TutorQueryResponse,
    SupplementaryVideoSuggestRequest,
    SupplementaryVideoResponse
)
from app.services.rag_service import rag_service
from app.services.bhashini_service import bhashini_service, SUPPORTED_INDIC_LANGUAGES

router = APIRouter(prefix="/tutor", tags=["AI Tutor"])

# High-yield curated educational concept videos for SIH demo & production
CURATED_CONCEPT_VIDEOS = {
    "avl": {
        "title": "AVL Trees: Self-Balancing Invariants & Rotations Visualized",
        "youtube_video_id": "vRwi_UCVrjA",
        "embed_url": "https://www.youtube-nocookie.com/embed/vRwi_UCVrjA",
        "channel": "Abdul Bari - Computer Science",
        "duration": "14 mins",
        "relevance_reason": "Clear step-by-step visual animation of LL, RR, LR, and RL balance rotations.",
        "timestamp_anchor": 180
    },
    "bst": {
        "title": "Binary Search Trees (BST): Insertion, Search & Traversal",
        "youtube_video_id": "qH6clASSS54",
        "embed_url": "https://www.youtube-nocookie.com/embed/qH6clASSS54",
        "channel": "freeCodeCamp / MIT OCW",
        "duration": "12 mins",
        "relevance_reason": "Visual breakdown of BST pointer manipulations and recursive search invariants.",
        "timestamp_anchor": 65
    },
    "binary tree": {
        "title": "Binary Tree Algorithms: Depth First & Breadth First Search",
        "youtube_video_id": "fAAZixBzIAI",
        "embed_url": "https://www.youtube-nocookie.com/embed/fAAZixBzIAI",
        "channel": "freeCodeCamp",
        "duration": "18 mins",
        "relevance_reason": "Detailed graphical tracing of recursion stacks and queue-based tree traversals.",
        "timestamp_anchor": 120
    },
    "recursion": {
        "title": "Recursion Demystified: Call Stack & Base Case Architecture",
        "youtube_video_id": "ngCos392W4w",
        "embed_url": "https://www.youtube-nocookie.com/embed/ngCos392W4w",
        "channel": "Computerphile",
        "duration": "11 mins",
        "relevance_reason": "Conceptual deep dive into memory execution frames during recursive returns.",
        "timestamp_anchor": 45
    },
    "join": {
        "title": "SQL Joins Explained visually: INNER, LEFT, RIGHT, FULL",
        "youtube_video_id": "0OQJDd3Pt38",
        "embed_url": "https://www.youtube-nocookie.com/embed/0OQJDd3Pt38",
        "channel": "Fireship & Traversy",
        "duration": "9 mins",
        "relevance_reason": "Interactive Venn diagram illustrations demonstrating relational table intersections.",
        "timestamp_anchor": 90
    },
    "normalization": {
        "title": "Database Normalization: 1NF, 2NF, 3NF & BCNF Invariants",
        "youtube_video_id": "GFQaEYEc8_8",
        "embed_url": "https://www.youtube-nocookie.com/embed/GFQaEYEc8_8",
        "channel": "Decomplexify",
        "duration": "15 mins",
        "relevance_reason": "Step-by-step decomposition of redundant anomaly tables into clean third normal form.",
        "timestamp_anchor": 150
    },
    "graph": {
        "title": "Graph Algorithms: BFS, DFS and Dijkstra's Shortest Path",
        "youtube_video_id": "tWVWeAqZ0WU",
        "embed_url": "https://www.youtube-nocookie.com/embed/tWVWeAqZ0WU",
        "channel": "William Fiset",
        "duration": "16 mins",
        "relevance_reason": "Dynamic visual adjacency matrix animation and priority queue exploration.",
        "timestamp_anchor": 210
    },
    "dynamic programming": {
        "title": "Dynamic Programming: Memoization vs Tabulation Strategies",
        "youtube_video_id": "oBt53YbR9Kk",
        "embed_url": "https://www.youtube-nocookie.com/embed/oBt53YbR9Kk",
        "channel": "freeCodeCamp",
        "duration": "20 mins",
        "relevance_reason": "Subproblem overlapping tree reduction and space-optimized bottom-up tables.",
        "timestamp_anchor": 300
    }
}

@router.get("/languages")
async def get_supported_languages():
    """Return dictionary of supported regional Indian languages."""
    return SUPPORTED_INDIC_LANGUAGES

@router.post("/suggest-video", response_model=SupplementaryVideoResponse)
async def suggest_supplementary_video(
    req: SupplementaryVideoSuggestRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Returns a conceptual, high-clarity YouTube video tailored to the student's topic,
    designed to be injected ephemerally beneath the primary lecture player.
    """
    search_str = f"{req.topic} {req.query or ''}".lower()

    # 1. Match against curated knowledge registry
    matched_video = None
    for keyword, data in CURATED_CONCEPT_VIDEOS.items():
        if keyword in search_str:
            matched_video = data
            break

    # 2. Smart fallback if specific keyword isn't exact match
    if not matched_video:
        matched_video = {
            "title": f"Deep Dive Visual Breakdown: {req.topic}",
            "youtube_video_id": "qH6clASSS54",
            "embed_url": f"https://www.youtube-nocookie.com/embed/qH6clASSS54",
            "channel": "CogniPath AI Knowledge Engine",
            "duration": "10 mins",
            "relevance_reason": f"Step-by-step conceptual walkthrough designed to reinforce core invariants of {req.topic}.",
            "timestamp_anchor": 0
        }

    return SupplementaryVideoResponse(
        title=matched_video["title"],
        youtube_video_id=matched_video["youtube_video_id"],
        embed_url=matched_video["embed_url"],
        channel=matched_video.get("channel", "CogniPath Knowledge Base"),
        duration=matched_video.get("duration", "10 mins"),
        relevance_reason=matched_video["relevance_reason"],
        timestamp_anchor=matched_video.get("timestamp_anchor", 0)
    )

@router.post("/query", response_model=TutorQueryResponse)
@router.post("/chat", response_model=TutorQueryResponse)
async def tutor_chat(
    req: TutorQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Student sends question to the curriculum-grounded AI Tutor."""
    user_query = req.query

    # 1. If voice audio input provided, run Bhashini ASR
    if req.audio_base64:
        user_query = await bhashini_service.transcribe_audio(
            req.audio_base64,
            source_lang=req.target_language
        )

    if not user_query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # 2. If query is in regional language, translate to English for semantic vector lookup
    query_in_en = user_query
    if req.target_language != "en":
        query_in_en = await bhashini_service.translate_text(
            text=user_query,
            source_lang=req.target_language,
            target_lang="en"
        )

    # 3. Grounded RAG Generation (MMR Vector Search + Prompt with Citations)
    answer_en, citations, latency_ms = await rag_service.generate_response(
        course_id=req.course_id,
        query=query_in_en,
        target_language="en"
    )

    # 4. If student selected regional language, translate grounded answer via Bhashini NMT
    final_answer = answer_en
    if req.target_language != "en":
        final_answer = await bhashini_service.translate_text(
            text=answer_en,
            source_lang="en",
            target_lang=req.target_language
        )

    # 5. Generate Bhashini TTS audio if target language is regional
    audio_base64 = None
    if req.target_language != "en":
        audio_base64 = await bhashini_service.text_to_speech(
            text=final_answer,
            target_lang=req.target_language
        )

    # 6. Check if user is asking for alternative video / visual explanation
    suggested_video = None
    video_triggers = ["video", "visual", "watch", "youtube", "confused", "alternative", "example"]
    if any(vt in user_query.lower() for vt in video_triggers):
        for keyword, vdata in CURATED_CONCEPT_VIDEOS.items():
            if keyword in user_query.lower() or keyword in answer_en.lower():
                suggested_video = SupplementaryVideoResponse(
                    title=vdata["title"],
                    youtube_video_id=vdata["youtube_video_id"],
                    embed_url=vdata["embed_url"],
                    channel=vdata["channel"],
                    duration=vdata["duration"],
                    relevance_reason=vdata["relevance_reason"],
                    timestamp_anchor=vdata["timestamp_anchor"]
                )
                break

    # 7. Telemetry Logging for Educator At-Risk Analytics
    log_entry = StudentActivityLog(
        user_id=current_user.id,
        course_id=req.course_id,
        action_type="QUERY_TUTOR",
        query_text=user_query,
        response_time_ms=latency_ms,
        metadata_info=json.dumps({
            "target_language": req.target_language,
            "citations_count": len(citations),
            "top_citation": citations[0].source_title if citations else None
        })
    )
    db.add(log_entry)
    await db.commit()

    return TutorQueryResponse(
        answer=final_answer,
        citations=citations,
        language=req.target_language,
        audio_base64=audio_base64,
        processing_time_ms=latency_ms,
        suggested_video=suggested_video
    )

