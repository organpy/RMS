"""Authentication service for JWT token management.

Handles creation, validation, and refreshing of JWT tokens for business entities.
Uses PyJWT for token signing/verification with configurable expiration times.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from pydantic import BaseModel

from ..config import get_settings


class TokenResponse(BaseModel):
    """Response containing access and refresh tokens."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenPayload(BaseModel):
    """Payload contained in JWT token."""
    
    business_id: str
    exp: int  # expiration timestamp
    iat: int  # issued at timestamp
    type: str  # "access" or "refresh"


class AuthService:
    """Service for managing JWT tokens and authentication.
    
    Generates tokens with business_id claim and handles validation.
    Separates access tokens (short-lived) from refresh tokens (long-lived).
    """
    
    def __init__(self, settings: Optional[object] = None):
        """Initialize auth service with configuration.
        
        Args:
            settings: Optional Settings instance; uses get_settings() if not provided
        """
        self.settings = settings or get_settings()
        self.algorithm = "HS256"
    
    def create_access_token(self, business_id: str) -> str:
        """Create short-lived access token (15 minutes).
        
        Args:
            business_id: The business entity identifier
            
        Returns:
            JWT token string
        """
        return self._create_token(
            business_id=business_id,
            token_type="access",
            expires_in=timedelta(minutes=15)
        )
    
    def create_refresh_token(self, business_id: str) -> str:
        """Create long-lived refresh token (7 days).
        
        Args:
            business_id: The business entity identifier
            
        Returns:
            JWT token string
        """
        return self._create_token(
            business_id=business_id,
            token_type="refresh",
            expires_in=timedelta(days=7)
        )
    
    def _create_token(
        self,
        business_id: str,
        token_type: str,
        expires_in: timedelta
    ) -> str:
        """Create a JWT token with specified lifetime.
        
        Args:
            business_id: The business entity identifier
            token_type: Either "access" or "refresh"
            expires_in: Token lifetime
            
        Returns:
            Signed JWT token string
        """
        now = datetime.now(tz=timezone.utc)
        expires_at = now + expires_in
        
        payload = {
            "business_id": business_id,
            "type": token_type,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
        }
        
        return jwt.encode(
            payload,
            self.settings.secret_key,
            algorithm=self.algorithm
        )
    
    def verify_token(self, token: str, token_type: str = "access") -> TokenPayload:
        """Verify and decode a JWT token.
        
        Args:
            token: The JWT token string to verify
            token_type: Expected token type ("access" or "refresh")
            
        Returns:
            Decoded token payload
            
        Raises:
            jwt.InvalidTokenError: If token is invalid, expired, or wrong type
            jwt.DecodeError: If token cannot be decoded
            jwt.ExpiredSignatureError: If token has expired
        """
        try:
            payload = jwt.decode(
                token,
                self.settings.secret_key,
                algorithms=[self.algorithm]
            )
            
            # Verify token type matches expected
            if payload.get("type") != token_type:
                raise jwt.InvalidTokenError("Invalid token type")
            
            return TokenPayload(**payload)
        
        except jwt.ExpiredSignatureError as e:
            raise jwt.ExpiredSignatureError("Token has expired") from e
        except jwt.InvalidTokenError as e:
            raise jwt.InvalidTokenError("Invalid token") from e
    
    def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """Generate new access token from valid refresh token.
        
        Args:
            refresh_token: The refresh token to use for renewal
            
        Returns:
            TokenResponse with new access and refresh tokens
            
        Raises:
            jwt.InvalidTokenError: If refresh token is invalid or expired
        """
        # Verify the refresh token
        payload = self.verify_token(refresh_token, token_type="refresh")
        
        # Create new access and refresh tokens
        access_token = self.create_access_token(payload.business_id)
        new_refresh_token = self.create_refresh_token(payload.business_id)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            expires_in=15 * 60  # 15 minutes in seconds
        )
