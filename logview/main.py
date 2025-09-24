"""Main FastAPI application for LogView."""

import json
import logging
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .auth import get_current_user, get_current_user_sse, require_file_access, user_header_auth
from .config import backend_config, get_user_groups, settings
from .file_service import FileInfo, file_service

print("DEBUG: main.py module loaded with updated code!")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

# Add CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=backend_config.cors.allow_origins,
    allow_credentials=backend_config.cors.allow_credentials,
    allow_methods=backend_config.cors.allow_methods,
    allow_headers=backend_config.cors.allow_headers,
)


# Add middleware to log failed requests
@app.middleware("http")
async def log_failed_requests(request: Request, call_next):
    """Log failed requests with reason."""
    response = await call_next(request)
    
    # Log failed requests (4xx and 5xx status codes)
    if response.status_code >= 400:
        user = request.headers.get(settings.auth_header, "unknown")
        logger.warning(
            f"Failed request: {request.method} {request.url.path} - "
            f"Status: {response.status_code} - User: {user} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )
    
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom handler for HTTP exceptions to log the reason."""
    user = request.headers.get(settings.auth_header, "unknown")
    logger.error(
        f"HTTP {exc.status_code} error: {exc.detail} - "
        f"Path: {request.url.path} - User: {user} - "
        f"Client: {request.client.host if request.client else 'unknown'}"
    )
    
    # Return the standard HTTPException response
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
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
        examples="app/logs",
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
        examples=1,
    ),
    page_size: Optional[int] = Query(
        default=None,
        ge=1,
        le=10000,
        description="Number of lines to return (default from config)",
        examples=1000,
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
    current_user: str = Depends(get_current_user_sse),
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
    logger.error(f"TAIL ENDPOINT DEBUG - current_user: {current_user}")
    
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



@app.get("/files/{file_path:path}/download")
async def download_file(
    file_path: str,
    request: Request,
    current_user: str = Depends(get_current_user),
):
    """Download a file that the user has access to.
    
    This endpoint allows downloading of files that the user has access to.
    The file is returned as an attachment with appropriate headers.
    
    Args:
        file_path: Path to the file relative to the configured base path
        request: FastAPI request object
        current_user: Current authenticated user from header
        
    Returns:
        File download response
        
    Raises:
        HTTPException: If file access is denied, file not found, or other errors
    """
    from fastapi.responses import FileResponse
    import os
    
    # Check access using existing file service
    try:
        # Verify access by trying to get file info
        file_service.get_file_content(current_user, file_path, 1, 1)
        
        # Get the actual file path
        absolute_path = file_service._get_absolute_path(file_path)
        
        if not absolute_path.exists() or not absolute_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Get filename for download
        filename = os.path.basename(file_path)
        
        return FileResponse(
            path=str(absolute_path),
            filename=filename,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading file: {str(e)}"
        )


def main() -> None:
    """Main entry point for running the application."""
    import uvicorn
    
    uvicorn.run(
        "logview.main:app",
        host=backend_config.host,
        port=backend_config.port,
        reload=False,
        access_log=True,
    )


if __name__ == "__main__":
    main()
