"""
Supabase Storage service — signed URLs and file management for consultation recordings.
"""
import os
from typing import Optional
from urllib.parse import urlparse

from loguru import logger
from supabase import create_client, Client


class StorageService:

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_service_key: Optional[str] = None,
        bucket: Optional[str] = None,
    ) -> None:
        self._supabase_url = (supabase_url or os.getenv("SUPABASE_URL", "")).strip()
        self._supabase_service_key = (supabase_service_key or os.getenv("SUPABASE_SERVICE_KEY", "")).strip()
        self._bucket = (bucket or os.getenv("SUPABASE_STORAGE_BUCKET", "consultation-recordings")).strip()
        self._client: Optional[Client] = None

    def _describe_target(self) -> str:
        parsed = urlparse(self._supabase_url)
        host = parsed.netloc or "missing-host"
        key_hint = (
            f"{self._supabase_service_key[:14]}..."
            if self._supabase_service_key
            else "missing-key"
        )
        return f"host={host}, bucket={self._bucket or 'missing-bucket'}, key={key_hint}"

    def _get_client(self) -> Client:
        if self._client is None:
            if not self._supabase_url or not self._supabase_service_key:
                raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY not configured")
            self._client = create_client(self._supabase_url, self._supabase_service_key)
        return self._client

    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """Return a signed URL for a recording file. expires_in is in seconds."""
        client = self._get_client()
        try:
            response = client.storage.from_(self._bucket).create_signed_url(storage_path, expires_in)
        except Exception as e:
            raise RuntimeError(
                f"Signed URL request failed for {storage_path} ({self._describe_target()}): {e}"
            ) from e
        url = response.get("signedURL") or response.get("signedUrl")
        if not url:
            raise RuntimeError(
                f"Could not generate signed URL for {storage_path} ({self._describe_target()}): {response}"
            )
        return url

    def delete_file(self, storage_path: str) -> None:
        """Delete a recording file from storage."""
        try:
            client = self._get_client()
            client.storage.from_(self._bucket).remove([storage_path])
            logger.info(f"Deleted storage file: {storage_path}")
        except Exception as e:
            logger.warning(f"Could not delete storage file {storage_path} ({self._describe_target()}): {e}")

    def is_configured(self) -> bool:
        return bool(self._supabase_url and self._supabase_service_key)


storage_service = StorageService()
