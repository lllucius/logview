"""Configuration management for LogView application."""

import re
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator
from pydantic_settings import BaseSettings


class GroupConfig(BaseModel):
    """Configuration for a file group with regex pattern and authorized users."""
    
    name: str = Field(..., description="Name of the group")
    pattern: str = Field(..., description="Regex pattern to match files within the base path")
    users: List[str] = Field(default_factory=list, description="List of users authorized for this group")
    description: Optional[str] = Field(None, description="Optional description of the group")
    
    @validator('pattern')
    def validate_pattern(cls, v: str) -> str:
        """Validate that the regex pattern is valid."""
        try:
            re.compile(v)
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {e}")
        return v


class Settings(BaseSettings):
    """Application settings with validation."""
    
    # Base path configuration
    base_path: Path = Field(
        default=Path("/var/log"),
        description="Base directory path where all log files are anchored"
    )
    
    # File group configurations
    groups: List[GroupConfig] = Field(
        default_factory=lambda: [
            GroupConfig(
                name="system",
                pattern=r"^(syslog|messages|auth\.log|kern\.log).*",
                users=["admin"],
                description="System log files"
            ),
            GroupConfig(
                name="application",
                pattern=r"^app/.*\.log$",
                users=["developer", "admin"],
                description="Application log files"
            )
        ],
        description="List of file groups with access control"
    )
    
    # Server configuration
    host: str = Field(default="0.0.0.0", description="Host to bind the server to")
    port: int = Field(default=8000, description="Port to bind the server to")
    
    # Authentication configuration
    auth_header: str = Field(
        default="X-User",
        description="HTTP header containing the authenticated username"
    )
    
    # File handling configuration
    max_file_size: int = Field(
        default=100 * 1024 * 1024,  # 100MB
        description="Maximum file size to serve (in bytes)"
    )
    default_page_size: int = Field(
        default=1000,
        description="Default number of lines per page for file content"
    )
    max_page_size: int = Field(
        default=10000,
        description="Maximum number of lines per page for file content"
    )
    tail_buffer_size: int = Field(
        default=1024,
        description="Buffer size for tail operations (in bytes)"
    )
    tail_check_interval: float = Field(
        default=1.0,
        description="Interval between file checks for tail operations (in seconds)"
    )
    
    @validator('base_path')
    def validate_base_path(cls, v: Path) -> Path:
        """Validate that base path exists and is a directory."""
        if not v.exists():
            raise ValueError(f"Base path does not exist: {v}")
        if not v.is_dir():
            raise ValueError(f"Base path is not a directory: {v}")
        return v.resolve()  # Convert to absolute path
    
    @validator('groups')
    def validate_groups(cls, v: List[GroupConfig]) -> List[GroupConfig]:
        """Validate that group names are unique."""
        names = [group.name for group in v]
        if len(names) != len(set(names)):
            raise ValueError("Group names must be unique")
        return v
    
    class Config:
        env_prefix = "LOGVIEW_"
        case_sensitive = False


# Global settings instance
settings = Settings()


def get_user_groups(username: str) -> List[str]:
    """Get list of group names that a user has access to.
    
    Args:
        username: The username to check access for
        
    Returns:
        List of group names the user can access
    """
    return [group.name for group in settings.groups if username in group.users]


def get_group_by_name(group_name: str) -> Optional[GroupConfig]:
    """Get group configuration by name.
    
    Args:
        group_name: Name of the group to retrieve
        
    Returns:
        GroupConfig if found, None otherwise
    """
    for group in settings.groups:
        if group.name == group_name:
            return group
    return None


def file_matches_group(file_path: str, group: GroupConfig) -> bool:
    """Check if a file path matches a group's pattern.
    
    Args:
        file_path: Relative path from base_path to check
        group: Group configuration to match against
        
    Returns:
        True if file matches the group pattern, False otherwise
    """
    return bool(re.match(group.pattern, file_path))


def get_accessible_groups_for_file(username: str, file_path: str) -> List[str]:
    """Get list of groups that both match the file and are accessible to the user.
    
    Args:
        username: Username to check access for
        file_path: Relative file path from base_path
        
    Returns:
        List of group names that match the file and are accessible to the user
    """
    user_groups = get_user_groups(username)
    matching_groups = []
    
    for group_name in user_groups:
        group = get_group_by_name(group_name)
        if group and file_matches_group(file_path, group):
            matching_groups.append(group_name)
    
    return matching_groups