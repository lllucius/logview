"""Authentication and authorization module for LogView."""

from typing import Optional

from fastapi import HTTPException, Request, status, Query
from fastapi.security import HTTPBearer
from fastapi.security.base import SecurityBase

from .config import get_accessible_groups_for_file, get_user_groups, settings


class UserHeaderAuth(SecurityBase):
    """Authentication via HTTP header containing username."""
    
    def __init__(self, header_name: str = "X-User"):
        """Initialize with header name.
        
        Args:
            header_name: Name of the HTTP header containing the username
        """
        self.header_name = header_name
        self.model = None
        self.scheme_name = "UserHeader"


def get_current_user(request: Request) -> str:
    """Extract the current user from the request headers.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Username from the configured header
        
    Raises:
        HTTPException: If no user header is found or is empty
    """
    user = request.headers.get(settings.auth_header)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Missing required header: {settings.auth_header}",
            headers={"WWW-Authenticate": "UserHeader"},
        )
    return user.strip()


def get_current_user_sse(request: Request) -> str:
    """Extract the current user for SSE endpoints from query param or header.
    
    This function supports both header-based and query parameter authentication
    for SSE endpoints since EventSource doesn't support custom headers.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Username from query parameter or header
        
    Raises:
        HTTPException: If no user is found in query param or header
    """
    # First try query parameter (for SSE)
    user_param = request.query_params.get("user")
    if user_param and user_param.strip():
        return user_param.strip()
    
    # Try header-based auth
    header_user = request.headers.get(settings.auth_header)
    if header_user and header_user.strip():
        return header_user.strip()
    
    # If neither works, raise error
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Missing required header: {settings.auth_header} or query parameter 'user'",
        headers={"WWW-Authenticate": "UserHeader"},
    )


def check_user_has_groups(username: str) -> bool:
    """Check if user has access to any groups.
    
    Args:
        username: Username to check
        
    Returns:
        True if user has access to at least one group, False otherwise
    """
    return len(get_user_groups(username)) > 0


def check_file_access(username: str, file_path: str) -> bool:
    """Check if user has access to a specific file.
    
    Args:
        username: Username to check access for
        file_path: Relative file path from base_path
        
    Returns:
        True if user has access to the file, False otherwise
    """
    accessible_groups = get_accessible_groups_for_file(username, file_path)
    return len(accessible_groups) > 0


def require_file_access(username: str, file_path: str) -> None:
    """Require that user has access to a file, raise exception if not.
    
    Args:
        username: Username to check access for
        file_path: Relative file path from base_path
        
    Raises:
        HTTPException: If user doesn't have access to the file
    """
    if not check_file_access(username, file_path):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to file: {file_path}",
        )


def require_group_access(username: str, group_name: str) -> None:
    """Require that user has access to a group, raise exception if not.
    
    Args:
        username: Username to check access for
        group_name: Name of the group to check
        
    Raises:
        HTTPException: If user doesn't have access to the group
    """
    user_groups = get_user_groups(username)
    if group_name not in user_groups:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to group: {group_name}",
        )


# Authentication dependency
user_header_auth = UserHeaderAuth(settings.auth_header)