"""
LiveKit service — room management, token generation, audio egress.
Requires env vars: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
"""
import os
import time
from datetime import timedelta
from typing import Optional

from livekit.api import (
    AccessToken,
    VideoGrants,
    LiveKitAPI,
    RoomCompositeEgressRequest,
    EncodedFileOutput,
    EncodedFileType,
    S3Upload,
    StopEgressRequest,
    DeleteRoomRequest,
)
from loguru import logger


_LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

# Supabase Storage S3-compatible endpoint for egress output
_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "consultation-recordings")
_STORAGE_S3_ENDPOINT = os.getenv("SUPABASE_STORAGE_S3_ENDPOINT", "")
_STORAGE_S3_ACCESS_KEY = os.getenv("SUPABASE_STORAGE_S3_ACCESS_KEY", "")
_STORAGE_S3_SECRET_KEY = os.getenv("SUPABASE_STORAGE_S3_SECRET_KEY", "")
_STORAGE_S3_REGION = os.getenv("SUPABASE_STORAGE_S3_REGION", "us-east-1")

# LiveKit token TTL for call participants
_TOKEN_TTL_SECONDS = 4 * 60 * 60  # 4 hours


class LiveKitService:

    def is_configured(self) -> bool:
        return bool(_LIVEKIT_URL and _API_KEY and _API_SECRET)

    def generate_room_name(self, call_session_id: str) -> str:
        return f"call-{call_session_id}"

    def generate_astrologer_token(
        self,
        room_name: str,
        astrologer_id: str,
        display_name: str,
    ) -> str:
        """JWT for the astrologer — can publish, subscribe, and control data."""
        grants = VideoGrants(
            room=room_name,
            room_join=True,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )
        token = (
            AccessToken(api_key=_API_KEY, api_secret=_API_SECRET)
            .with_identity(f"astrologer-{astrologer_id}")
            .with_name(display_name)
            .with_grants(grants)
            .with_ttl(timedelta(seconds=_TOKEN_TTL_SECONDS))
            .to_jwt()
        )
        return token

    def generate_client_token(
        self,
        room_name: str,
        user_id: str,
        display_name: str,
    ) -> str:
        """JWT for the client — can publish and subscribe."""
        grants = VideoGrants(
            room=room_name,
            room_join=True,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=False,
        )
        token = (
            AccessToken(api_key=_API_KEY, api_secret=_API_SECRET)
            .with_identity(f"client-{user_id}")
            .with_name(display_name)
            .with_grants(grants)
            .with_ttl(timedelta(seconds=_TOKEN_TTL_SECONDS))
            .to_jwt()
        )
        return token

    async def start_audio_egress(
        self,
        room_name: str,
        call_session_id: str,
        astrologer_id: str,
        user_id: str,
    ) -> Optional[str]:
        """
        Start audio-only composite egress for the room.
        Outputs an OGG file to Supabase Storage (S3-compatible).
        Returns egress_id on success, None if storage is not configured.
        """
        if not self.is_configured():
            logger.warning("LiveKit not configured — skipping egress start")
            return None

        storage_path = f"{astrologer_id}/{user_id}/{call_session_id}.ogg"

        try:
            async with LiveKitAPI(
                url=_LIVEKIT_URL,
                api_key=_API_KEY,
                api_secret=_API_SECRET,
            ) as lk:
                # Audio-only composite egress: record all audio tracks mixed together
                req = RoomCompositeEgressRequest(
                    room_name=room_name,
                    audio_only=True,
                    file=EncodedFileOutput(
                        file_type=EncodedFileType.OGG,
                        filepath=storage_path,
                        s3=S3Upload(
                            access_key=_STORAGE_S3_ACCESS_KEY,
                            secret=_STORAGE_S3_SECRET_KEY,
                            bucket=_STORAGE_BUCKET,
                            region=_STORAGE_S3_REGION,
                            endpoint=_STORAGE_S3_ENDPOINT,
                            force_path_style=True,  # Required for Supabase Storage S3 API
                        ),
                    ),
                )
                egress = await lk.egress.start_room_composite_egress(req)
                logger.info(f"Started audio egress {egress.egress_id} for room {room_name}")
                return egress.egress_id

        except Exception as e:
            logger.error(f"Failed to start audio egress for room {room_name}: {e}")
            raise

    async def stop_egress(self, egress_id: str) -> None:
        """Stop an active egress by ID."""
        if not egress_id or not self.is_configured():
            return
        try:
            async with LiveKitAPI(
                url=_LIVEKIT_URL,
                api_key=_API_KEY,
                api_secret=_API_SECRET,
            ) as lk:
                await lk.egress.stop_egress(StopEgressRequest(egress_id=egress_id))
                logger.info(f"Stopped egress {egress_id}")
        except Exception as e:
            logger.error(f"Failed to stop egress {egress_id}: {e}")
            raise

    async def delete_room(self, room_name: str) -> None:
        """Delete a LiveKit room after the call ends."""
        if not self.is_configured():
            return
        try:
            async with LiveKitAPI(
                url=_LIVEKIT_URL,
                api_key=_API_KEY,
                api_secret=_API_SECRET,
            ) as lk:
                await lk.room.delete_room(DeleteRoomRequest(room=room_name))
                logger.info(f"Deleted LiveKit room {room_name}")
        except Exception as e:
            # Room may already be gone — log and continue
            logger.warning(f"Could not delete room {room_name}: {e}")

    def verify_webhook(self, body: bytes, auth_header: str) -> dict:
        """
        Verify a LiveKit webhook signature and return the parsed event.
        Raises ValueError if the signature is invalid.
        """
        from livekit.api import WebhookReceiver
        receiver = WebhookReceiver(_API_KEY, _API_SECRET)
        try:
            event = receiver.receive(body, auth_header)
            return event
        except Exception as e:
            raise ValueError(f"Invalid LiveKit webhook: {e}") from e


livekit_service = LiveKitService()
