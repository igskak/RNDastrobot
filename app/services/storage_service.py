"""
Supabase Storage service — signed URLs and file management for consultation recordings.
"""
import os
from typing import Optional

from loguru import logger
from supabase import create_client, Client

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "consultation-recordings")


class StorageService:

    def __init__(self) -> None:
        self._client: Optional[Client] = None

    def _get_client(self) -> Client:
        if self._client is None:
            if not _SUPABASE_URL or not _SUPABASE_SERVICE_KEY:
                raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY not configured")
            self._client = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_KEY)
        return self._client

    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """Return a signed URL for a recording file. expires_in is in seconds."""
        client = self._get_client()
        response = client.storage.from_(_BUCKET).create_signed_url(storage_path, expires_in)
        url = response.get("signedURL") or response.get("signedUrl")
        if not url:
            raise RuntimeError(f"Could not generate signed URL for {storage_path}: {response}")
        return url

    def delete_file(self, storage_path: str) -> None:
        """Delete a recording file from storage."""
        try:
            client = self._get_client()
            client.storage.from_(_BUCKET).remove([storage_path])
            logger.info(f"Deleted storage file: {storage_path}")
        except Exception as e:
            logger.warning(f"Could not delete storage file {storage_path}: {e}")

    def is_configured(self) -> bool:
        return bool(_SUPABASE_URL and _SUPABASE_SERVICE_KEY)


storage_service = StorageService()
