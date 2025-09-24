"""Main FastAPI application for LogView."""

import json
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .auth import get_current_user, require_file_access, user_header_auth
from .config import get_user_groups, settings
from .file_service import FileInfo, file_service


class FileListResponse(BaseModel):
    """Response model for file listing."""
    
    files: List[Dict] = Field(..., description="List of accessible files with metadata")
    directory: str = Field(..., description="Directory path that was listed")
    user_groups: List[str] = Field(..., description="Groups the user has access to")


class FileContentResponse(BaseModel):
    """Response model for file content."""
    
    content: List[str] = Field(..., description="File content lines")
    file_path: str = Field(..., description="Path to the file")
    start_line: int = Field(..., description="Starting line number (1-based)")
    page_size: int = Field(..., description="Number of lines returned")
    total_lines: int = Field(..., description="Total number of lines in the file")
    has_more: bool = Field(..., description="Whether there are more lines available")


class UserInfoResponse(BaseModel):
    """Response model for user information."""
    
    username: str = Field(..., description="The authenticated username")
    groups: List[str] = Field(..., description="Groups the user has access to")


# Create FastAPI application
app = FastAPI(
    title="LogView",
    description="""
    FastAPI application for remote log file viewing with access control.
    
    ## Features
    
    * **File Listing**: List files with metadata that the user has access to
    * **File Content**: Get file content with pagination support
    * **File Tailing**: Real-time file tailing using Server-Sent Events
    * **Access Control**: Group-based access control with regex pattern matching
    * **Security**: All file access is anchored to a configured base path
    
    ## Authentication
    
    Authentication is handled via HTTP headers. Include the username in the 
    `X-User` header (or as configured in `LOGVIEW_AUTH_HEADER`).
    
    ## Authorization
    
    Users are granted access to files based on group membership. Each group
    defines a regex pattern that matches files within the base path, and
    lists the users who can access those files.
    """,
    version="0.1.0",
    contact={
        "name": "LogView Support",
        "url": "https://github.com/lllucius/logview",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)


@app.get("/", response_model=Dict[str, str])
async def root() -> Dict[str, str]:
    """Root endpoint providing basic application information.
    
    Returns:
        Dictionary with application name and version
    """
    return {
        "application": "LogView",
        "version": "0.1.0",
        "description": "FastAPI application for remote log file viewing",
    }


@app.get("/health", response_model=Dict[str, str])
async def health_check() -> Dict[str, str]:
    """Health check endpoint.
    
    Returns:
        Health status of the application
    """
    return {"status": "healthy"}


@app.get("/user", response_model=UserInfoResponse)
async def get_user_info(
    request: Request,
    current_user: str = Depends(get_current_user),
) -> UserInfoResponse:
    """Get information about the current authenticated user.
    
    Args:
        request: FastAPI request object
        current_user: Current authenticated user from header
        
    Returns:
        User information including accessible groups
    """
    user_groups = get_user_groups(current_user)
    return UserInfoResponse(username=current_user, groups=user_groups)


@app.get("/files", response_model=FileListResponse)
async def list_files(
    request: Request,
    directory: str = Query(
        default="",
        description="Directory path relative to base path (empty for root)",
        example="app/logs",
    ),
    current_user: str = Depends(get_current_user),
) -> FileListResponse:
    """List files in a directory that the user has access to.
    
    This endpoint returns all files within the specified directory that match
    at least one group pattern that the user has access to. File metadata
    includes size, modification time, and accessibility information.
    
    Args:
        request: FastAPI request object
        directory: Directory path relative to the configured base path
        current_user: Current authenticated user from header
        
    Returns:
        List of accessible files with metadata and user group information
        
    Raises:
        HTTPException: If directory doesn't exist or access is denied
    """
    files = file_service.list_files(current_user, directory)
    file_dicts = [file_info.to_dict() for file_info in files]
    user_groups = get_user_groups(current_user)
    
    return FileListResponse(
        files=file_dicts,
        directory=directory,
        user_groups=user_groups,
    )


@app.get("/files/{file_path:path}", response_model=FileContentResponse)
async def get_file(
    file_path: str,
    request: Request,
    start_line: int = Query(
        default=1,
        ge=1,
        description="Starting line number (1-based)",
        example=1,
    ),
    page_size: Optional[int] = Query(
        default=None,
        ge=1,
        le=10000,
        description="Number of lines to return (default from config)",
        example=1000,
    ),
    current_user: str = Depends(get_current_user),
) -> FileContentResponse:
    """Get file content with pagination support.
    
    This endpoint returns the content of a file that the user has access to,
    with support for pagination through large files. The response includes
    the requested lines, pagination metadata, and information about whether
    more content is available.
    
    Args:
        file_path: Path to the file relative to the configured base path
        request: FastAPI request object
        start_line: Starting line number (1-based)
        page_size: Number of lines to return (uses default if not specified)
        current_user: Current authenticated user from header
        
    Returns:
        File content with pagination metadata
        
    Raises:
        HTTPException: If file access is denied, file not found, or other errors
    """
    lines, total_lines, has_more = file_service.get_file_content(
        current_user, file_path, start_line, page_size
    )
    
    actual_page_size = page_size if page_size is not None else settings.default_page_size
    
    return FileContentResponse(
        content=lines,
        file_path=file_path,
        start_line=start_line,
        page_size=actual_page_size,
        total_lines=total_lines,
        has_more=has_more,
    )


@app.get("/files/{file_path:path}/tail")
async def tail_file(
    file_path: str,
    request: Request,
    current_user: str = Depends(get_current_user),
) -> StreamingResponse:
    """Tail a file using Server-Sent Events (SSE).
    
    This endpoint provides real-time tailing of a file that the user has access to.
    New lines are streamed to the client as they appear in the file using the
    Server-Sent Events protocol. The connection will remain open and continue
    to stream new content until the client disconnects.
    
    The response uses the `text/event-stream` content type with SSE format:
    - Each line is sent as a separate SSE event
    - Events have the format: `data: <line_content>\\n\\n`
    - Clients should handle the SSE stream appropriately
    
    Args:
        file_path: Path to the file relative to the configured base path
        request: FastAPI request object
        current_user: Current authenticated user from header
        
    Returns:
        StreamingResponse with Server-Sent Events containing new file lines
        
    Raises:
        HTTPException: If file access is denied, file not found, or other errors
    """
    async def generate_sse():
        """Generate Server-Sent Events for file tail."""
        try:
            async for line in file_service.tail_file(current_user, file_path):
                # Format as Server-Sent Event
                yield f"data: {json.dumps(line)}\n\n"
        except Exception as e:
            # Send error as SSE event
            yield f"event: error\ndata: {json.dumps(str(e))}\n\n"
    
    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@app.get("/config/groups")
async def get_groups(
    request: Request,
    current_user: str = Depends(get_current_user),
) -> Dict:
    """Get information about available groups and user access.
    
    This endpoint returns information about all configured groups and
    indicates which ones the current user has access to. This can be
    useful for understanding the access control structure.
    
    Args:
        request: FastAPI request object
        current_user: Current authenticated user from header
        
    Returns:
        Dictionary containing group information and user access details
    """
    user_groups = get_user_groups(current_user)
    
    groups_info = []
    for group in settings.groups:
        group_info = {
            "name": group.name,
            "pattern": group.pattern,
            "description": group.description,
            "user_has_access": group.name in user_groups,
        }
        # Only include user list if the user has access to the group
        if group.name in user_groups:
            group_info["users"] = group.users
        groups_info.append(group_info)
    
    return {
        "groups": groups_info,
        "user_groups": user_groups,
        "base_path": str(settings.base_path),
    }


def main() -> None:
    """Main entry point for running the application."""
    import uvicorn
    
    uvicorn.run(
        "logview.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        access_log=True,
    )


if __name__ == "__main__":
    main()