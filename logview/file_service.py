"""File service module for handling file operations."""

import asyncio
import os
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from .config import get_accessible_groups_for_file, get_user_groups, settings


class FileInfo:
    """Information about a file."""
    
    def __init__(self, path: Path, relative_path: str):
        """Initialize file info.
        
        Args:
            path: Absolute path to the file
            relative_path: Path relative to base_path
        """
        self.path = path
        self.relative_path = relative_path
        self._stat = path.stat()
    
    @property
    def name(self) -> str:
        """Get the file name."""
        return self.path.name
    
    @property
    def size(self) -> int:
        """Get the file size in bytes."""
        return self._stat.st_size
    
    @property
    def modified_time(self) -> float:
        """Get the last modified time as timestamp."""
        return self._stat.st_mtime
    
    @property
    def is_file(self) -> bool:
        """Check if this is a regular file."""
        return self.path.is_file()
    
    @property
    def is_readable(self) -> bool:
        """Check if the file is readable."""
        return os.access(self.path, os.R_OK)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API response."""
        return {
            "name": self.name,
            "size": self.size,
            "modified_time": self.modified_time,
            "is_file": self.is_file,
            "is_readable": self.is_readable,
        }


class FileService:
    """Service for file operations with access control."""
    
    def __init__(self):
        """Initialize the file service."""
        self.base_path = settings.base_path
    
    def _get_absolute_path(self, relative_path: str) -> Path:
        """Convert relative path to absolute path within base_path.
        
        Args:
            relative_path: Path relative to base_path
            
        Returns:
            Absolute path within base_path
            
        Raises:
            HTTPException: If path is outside base_path
        """
        # Normalize the relative path to prevent directory traversal
        relative_path = relative_path.lstrip("/")
        absolute_path = (self.base_path / relative_path).resolve()
        
        # Ensure the path is within base_path
        try:
            absolute_path.relative_to(self.base_path)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Path is outside the allowed base directory",
            )
        
        return absolute_path
    
    def _get_relative_path(self, absolute_path: Path) -> str:
        """Get relative path from base_path.
        
        Args:
            absolute_path: Absolute path to convert
            
        Returns:
            Path relative to base_path
        """
        return str(absolute_path.relative_to(self.base_path))
    
    def list_files(self, username: str, directory: str = "") -> List[FileInfo]:
        """List files that the user has access to in a directory.
        
        Args:
            username: Username requesting the files
            directory: Directory path relative to base_path (default: root)
            
        Returns:
            List of FileInfo objects the user can access
            
        Raises:
            HTTPException: If directory doesn't exist or access is denied
        """
        dir_path = self._get_absolute_path(directory)
        
        if not dir_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Directory not found",
            )
        
        if not dir_path.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Path is not a directory",
            )
        
        accessible_files = []
        user_groups = get_user_groups(username)
        
        if not user_groups:
            return []  # User has no group access
        
        try:
            for item in dir_path.iterdir():
                relative_path = self._get_relative_path(item)
                
                # Check if user has access to this file
                if get_accessible_groups_for_file(username, relative_path):
                    accessible_files.append(FileInfo(item, relative_path))
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied to list directory",
            )
        
        return sorted(accessible_files, key=lambda f: f.name)
    
    def get_file_content(
        self,
        username: str,
        file_path: str,
        start_line: int = 1,
        page_size: int = None,
    ) -> Tuple[List[str], int, bool]:
        """Get file content with pagination.
        
        Args:
            username: Username requesting the file
            file_path: File path relative to base_path
            start_line: Starting line number (1-based)
            page_size: Number of lines to return (None for default)
            
        Returns:
            Tuple of (lines, total_lines, has_more)
            
        Raises:
            HTTPException: If file access is denied or other errors
        """
        if page_size is None:
            page_size = settings.default_page_size
        
        page_size = min(page_size, settings.max_page_size)
        
        # Check access
        if not get_accessible_groups_for_file(username, file_path):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to file: {file_path}",
            )
        
        absolute_path = self._get_absolute_path(file_path)
        
        if not absolute_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )
        
        if not absolute_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Path is not a file",
            )
        
        if absolute_path.stat().st_size > settings.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File is too large to serve",
            )
        
        try:
            with open(absolute_path, 'r', encoding='utf-8', errors='replace') as f:
                # Count total lines first
                total_lines = sum(1 for _ in f)
                
                # Reset to beginning
                f.seek(0)
                
                # Skip to start line
                for _ in range(start_line - 1):
                    try:
                        next(f)
                    except StopIteration:
                        break
                
                # Read requested lines
                lines = []
                for _ in range(page_size):
                    try:
                        line = next(f).rstrip('\n\r')
                        lines.append(line)
                    except StopIteration:
                        break
                
                has_more = (start_line + len(lines) - 1) < total_lines
                
                return lines, total_lines, has_more
                
        except (PermissionError, OSError) as e:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot read file: {str(e)}",
            )
    
    async def tail_file(self, username: str, file_path: str) -> AsyncGenerator[str, None]:
        """Tail a file, yielding new lines as they appear.
        
        Args:
            username: Username requesting the tail
            file_path: File path relative to base_path
            
        Yields:
            New lines as they appear in the file
            
        Raises:
            HTTPException: If file access is denied or other errors
        """
        # Check access
        if not get_accessible_groups_for_file(username, file_path):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to file: {file_path}",
            )
        
        absolute_path = self._get_absolute_path(file_path)
        
        if not absolute_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )
        
        if not absolute_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Path is not a file",
            )
        
        try:
            with open(absolute_path, 'r', encoding='utf-8', errors='replace') as f:
                # Seek to end of file
                f.seek(0, 2)
                
                while True:
                    line = f.readline()
                    if line:
                        yield line.rstrip('\n\r')
                    else:
                        # No new data, wait before checking again
                        await asyncio.sleep(settings.tail_check_interval)
                        
        except (PermissionError, OSError) as e:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot read file: {str(e)}",
            )


# Global file service instance
file_service = FileService()