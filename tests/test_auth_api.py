"""Tests for authentication API endpoints.

These tests verify that JWT token generation and validation work correctly.
Note: Auth is disabled by default during testing (require_auth=false in conftest.py),
so protected endpoint tests would not work. In production, set require_auth=true
to enforce authentication on all endpoints.
"""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import create_app
from backend.database import get_db
from backend.models.base import Base


def _create_test_client():
    """Helper to create a fresh test client for auth tests."""
    TEST_DATABASE_URL = "sqlite+pysqlite:///:memory:"
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    
    connection = engine.connect()
    transaction = connection.begin()
    TestingSession = sessionmaker(bind=connection, autoflush=False, autocommit=False, future=True)
    session = TestingSession()
    
    app = create_app()
    
    def override_get_db():
        yield session
    
    app.dependency_overrides[get_db] = override_get_db
    
    client = TestClient(app)
    
    return client, app, session, transaction, connection, engine


class TestAuthLogin:
    """Test suite for POST /api/auth/login endpoint."""
    
    def test_login_success(self):
        """Test successful login returns access and refresh tokens."""
        client, app, session, transaction, connection, engine = _create_test_client()
        
        try:
            response = client.post(
                "/api/auth/login",
                json={"business_id": "test-business-123"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["token_type"] == "bearer"
            assert data["expires_in"] == 900  # 15 minutes
        finally:
            app.dependency_overrides.clear()
            session.close()
            transaction.rollback()
            connection.close()
            Base.metadata.drop_all(engine)
            engine.dispose()
    
    def test_login_empty_business_id(self):
        """Test login fails with empty business_id."""
        client, app, session, transaction, connection, engine = _create_test_client()
        
        try:
            response = client.post(
                "/api/auth/login",
                json={"business_id": ""}
            )
            
            assert response.status_code == 401
            assert response.json()["code"] == "authentication_error"
        finally:
            app.dependency_overrides.clear()
            session.close()
            transaction.rollback()
            connection.close()
            Base.metadata.drop_all(engine)
            engine.dispose()
    
    def test_login_missing_business_id(self):
        """Test login fails with missing business_id."""
        client, app, session, transaction, connection, engine = _create_test_client()
        
        try:
            response = client.post(
                "/api/auth/login",
                json={}
            )
            
            assert response.status_code == 422  # Validation error
        finally:
            app.dependency_overrides.clear()
            session.close()
            transaction.rollback()
            connection.close()
            Base.metadata.drop_all(engine)
            engine.dispose()


class TestAuthRefresh:
    """Test suite for POST /api/auth/refresh endpoint."""
    
    def test_refresh_success(self):
        """Test successful token refresh."""
        client, app, session, transaction, connection, engine = _create_test_client()
        
        try:
            # First login to get a refresh token
            login_response = client.post(
                "/api/auth/login",
                json={"business_id": "test-business-123"}
            )
            refresh_token = login_response.json()["refresh_token"]
            
            # Refresh the token
            response = client.post(
                "/api/auth/refresh",
                json={"refresh_token": refresh_token}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["token_type"] == "bearer"
            assert len(data["access_token"]) > 0
            assert len(data["refresh_token"]) > 0
        finally:
            app.dependency_overrides.clear()
            session.close()
            transaction.rollback()
            connection.close()
            Base.metadata.drop_all(engine)
            engine.dispose()
    
    def test_refresh_invalid_token(self):
        """Test refresh fails with invalid token."""
        client, app, session, transaction, connection, engine = _create_test_client()
        
        try:
            response = client.post(
                "/api/auth/refresh",
                json={"refresh_token": "invalid-token"}
            )
            
            assert response.status_code == 401
            assert response.json()["code"] == "authentication_error"
        finally:
            app.dependency_overrides.clear()
            session.close()
            transaction.rollback()
            connection.close()
            Base.metadata.drop_all(engine)
            engine.dispose()
    
    def test_refresh_with_access_token(self):
        """Test refresh fails when using access token instead of refresh token."""
        client, app, session, transaction, connection, engine = _create_test_client()
        
        try:
            # Get tokens
            login_response = client.post(
                "/api/auth/login",
                json={"business_id": "test-business-123"}
            )
            access_token = login_response.json()["access_token"]
            
            # Try to refresh with access token (wrong type)
            response = client.post(
                "/api/auth/refresh",
                json={"refresh_token": access_token}
            )
            
            assert response.status_code == 401
            assert response.json()["code"] == "authentication_error"
        finally:
            app.dependency_overrides.clear()
            session.close()
            transaction.rollback()
            connection.close()
            Base.metadata.drop_all(engine)
            engine.dispose()
