"""Authentication router for login and token refresh endpoints.

Provides:
- POST /api/auth/login - Login with business_id, returns access and refresh tokens
- POST /api/auth/refresh - Refresh expired access token using refresh token
"""

from typing import Annotated

import jwt
from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel

from ..config import get_settings
from ..exceptions import AuthenticationError
from ..services.auth_service import AuthService, TokenResponse

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    """Request body for login endpoint."""
    
    business_id: str


class RefreshRequest(BaseModel):
    """Request body for token refresh endpoint."""
    
    refresh_token: str


@auth_router.post("/login", response_model=TokenResponse)
def login(
    request: Annotated[LoginRequest, Body()],
    auth_service: Annotated[AuthService, Depends(lambda: AuthService(get_settings()))]
) -> TokenResponse:
    """Login endpoint that returns access and refresh tokens.
    
    Args:
        request: LoginRequest containing business_id
        auth_service: Injected AuthService instance
        
    Returns:
        TokenResponse with access_token and refresh_token
        
    Raises:
        AuthenticationError: If business_id is invalid/missing
    """
    if not request.business_id or not request.business_id.strip():
        raise AuthenticationError("business_id is required")
    
    # Create tokens
    access_token = auth_service.create_access_token(request.business_id)
    refresh_token = auth_service.create_refresh_token(request.business_id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=15 * 60  # 15 minutes in seconds
    )


@auth_router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Annotated[RefreshRequest, Body()],
    auth_service: Annotated[AuthService, Depends(lambda: AuthService(get_settings()))]
) -> TokenResponse:
    """Refresh access token using a valid refresh token.
    
    Args:
        request: RefreshRequest containing refresh_token
        auth_service: Injected AuthService instance
        
    Returns:
        TokenResponse with new access_token and refresh_token
        
    Raises:
        AuthenticationError: If refresh token is invalid or expired
    """
    try:
        return auth_service.refresh_access_token(request.refresh_token)
    except (jwt.InvalidTokenError, jwt.ExpiredSignatureError) as e:
        raise AuthenticationError(f"Invalid refresh token: {str(e)}")
