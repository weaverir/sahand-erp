"""Private, fail-closed face matching service. No face data written to disk.

The pretrained InsightFace weights are NOT bundled; check their commercial license.
Production requires an independently validated liveness implementation.
"""
import base64
import hashlib
import hmac
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Sahand private face service", docs_url=None, redoc_url=None)
SECRET = os.environ.get("LOCAL_FACE_SERVICE_KEY", "")
TTL = 300
LOCK = threading.Lock()

@dataclass
class Session:
    challenge_id: str
    nonce_hash: str
    subject_id: str
    action: str
    created: float
    frames: list[tuple[float, bytes]] = field(default_factory=list)

SESSIONS: dict[str, Session] = {}

class Start(BaseModel):
    challengeId: str = Field(min_length=1, max_length=128)
    challengeNonce: str = Field(min_length=20, max_length=128)
    subjectId: str = Field(min_length=1, max_length=128)
    action: str

class Frame(BaseModel):
    sessionToken: str
    challengeId: str
    challengeNonce: str
    subjectId: str
    frameBase64: str = Field(max_length=1_500_000)

class Verify(BaseModel):
    challengeId: str
    challengeNonce: str
    subjectId: str
    action: str
    liveSessionToken: str
    referenceImageBase64: str = Field(max_length=4_000_000)
    referenceImageMimeType: str


def authenticate(authorization: str | None):
    if not SECRET or len(SECRET) < 32:
        raise HTTPException(503, "Service secret not configured")
    if not authorization or not hmac.compare_digest(authorization, "Bearer " + SECRET):
        raise HTTPException(401, "Unauthorized")


def decode_image(value: str, max_bytes: int) -> np.ndarray:
    try:
        raw = base64.b64decode(value, validate=True)
    except Exception:
        raise HTTPException(422, "Invalid image encoding")
    if not raw or len(raw) > max_bytes:
        raise HTTPException(413, "Invalid image size")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.shape[0] < 160 or image.shape[1] < 160 or image.shape[0] * image.shape[1] > 2_000_000:
        raise HTTPException(422, "Invalid image dimensions")
    return image


def cleanup():
    now = time.monotonic()
    for token, session in list(SESSIONS.items()):
        if now - session.created > TTL:
            del SESSIONS[token]


@app.get("/health")
def health():
    return {"status": "ok", "mode": "fail_closed_until_liveness_configured"}


@app.post("/v1/sessions")
def start(body: Start, authorization: str | None = Header(default=None)):
    authenticate(authorization)
    if body.action not in ("CHECK_IN", "CHECK_OUT"):
        raise HTTPException(422, "Invalid action")
    with LOCK:
        cleanup()
        token = secrets.token_urlsafe(48)
        SESSIONS[token] = Session(body.challengeId, hashlib.sha256(body.challengeNonce.encode()).hexdigest(), body.subjectId, body.action, time.monotonic())
    return {"sessionToken": token, "expiresInSeconds": TTL}


@app.post("/v1/frames")
def add_frame(body: Frame, authorization: str | None = Header(default=None)):
    authenticate(authorization)
    image = decode_image(body.frameBase64, 800_000)
    with LOCK:
        cleanup()
        session = SESSIONS.get(body.sessionToken)
        if session is None:
            raise HTTPException(404, "Session expired")
        if (session.challenge_id != body.challengeId or session.subject_id != body.subjectId or
            not hmac.compare_digest(session.nonce_hash, hashlib.sha256(body.challengeNonce.encode()).hexdigest())):
            raise HTTPException(403, "Frame not authorized for session")
        now = time.monotonic()
        if session.frames and now - session.frames[-1][0] < 0.6:
            raise HTTPException(429, "Capture frames more slowly")
        if len(session.frames) >= 6:
            raise HTTPException(409, "Frame limit reached")
        # Keep decoded/re-encoded frame only in process memory; never persist.
        ok, jpg = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ok:
            raise HTTPException(422, "Invalid image")
        session.frames.append((now, jpg.tobytes()))
        count = len(session.frames)
    return {"received": count}


def embedding(image: np.ndarray) -> np.ndarray:
    # Load only explicitly provisioned weights. Do not download models at runtime.
    from insightface.app import FaceAnalysis
    if not hasattr(embedding, "engine"):
        model_root = os.environ.get("LOCAL_FACE_MODEL_ROOT")
        if not model_root or not os.path.isdir(model_root):
            raise HTTPException(503, "Licensed face model not provisioned")
        engine = FaceAnalysis(name=os.environ.get("LOCAL_FACE_MODEL_NAME", "buffalo_l"), root=model_root, providers=["CPUExecutionProvider"])
        engine.prepare(ctx_id=-1, det_size=(640, 640))
        embedding.engine = engine
    faces = embedding.engine.get(image)
    if len(faces) != 1:
        raise HTTPException(422, "Exactly one face required")
    return faces[0].normed_embedding


def liveness_check(images: list[np.ndarray]) -> bool:
    # Intentionally fail closed. Replace with a validated, licensed PAD model
    # (ISO/IEC 30107-3 testing) before enabling real attendance.
    # Head turns/blinks alone are NOT adequate proof of liveness.
    return False


@app.post("/v1/verify")
def verify(body: Verify, authorization: str | None = Header(default=None)):
    authenticate(authorization)
    with LOCK:
        cleanup()
        session = SESSIONS.pop(body.liveSessionToken, None)  # one-use even on failure
    if not session:
        raise HTTPException(403, "Session invalid or consumed")
    if (session.challenge_id != body.challengeId or session.subject_id != body.subjectId or
        session.action != body.action or not hmac.compare_digest(session.nonce_hash, hashlib.sha256(body.challengeNonce.encode()).hexdigest())):
        raise HTTPException(403, "Session does not match challenge")
    if len(session.frames) < 3 or session.frames[-1][0] - session.frames[0][0] < 1.5:
        raise HTTPException(422, "Insufficient live frames")
    images = [cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR) for _, raw in session.frames]
    reference = decode_image(body.referenceImageBase64, 2_000_000)
    if not liveness_check(images):
        return {"verified": False, "livenessPassed": False, "similarityScore": 0.0,
                "provider": "SAHAND_LOCAL", "verificationId": secrets.token_hex(16)}
    reference_vector = embedding(reference)
    live_vector = embedding(images[-1])
    score = float(np.dot(reference_vector, live_vector))
    threshold = float(os.environ.get("LOCAL_FACE_MATCH_THRESHOLD", "0.75"))
    normalized_score = max(0.0, min(1.0, (score + 1) / 2))
    return {"verified": normalized_score >= threshold, "livenessPassed": True,
            "similarityScore": normalized_score,
            "provider": "SAHAND_LOCAL", "verificationId": secrets.token_hex(16)}
