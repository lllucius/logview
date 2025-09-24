"""Configuration management for LogView application."""

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator


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


class CORSConfig(BaseModel):
    """CORS configuration."""
    
    allow_origins: List[str] = Field(default=["*"], description="Allowed origins for CORS")
    allow_credentials: bool = Field(default=True, description="Allow credentials in CORS requests")
    allow_methods: List[str] = Field(default=["*"], description="Allowed HTTP methods")
    allow_headers: List[str] = Field(default=["*"], description="Allowed HTTP headers")


class ServerConfig(BaseModel):
    """Configuration for a single server instance."""
    
    id: str = Field(..., description="Unique identifier for the server")
    name: str = Field(..., description="Display name for the server")
    host: str = Field(default="0.0.0.0", description="Host to bind the server to")
    port: int = Field(default=8000, description="Port to bind the server to")
    
    # Base path configuration
    base_path: Path = Field(
        default=Path("/var/log"),
        description="Base directory path where all log files are anchored"
    )
    
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
    
    # File group configurations
    groups: List[GroupConfig] = Field(
        default_factory=list,
        description="List of file groups with access control for this server"
    )
    
    @validator('base_path')
    def validate_base_path(cls, v: Path) -> Path:
        """Validate that base path exists and is a directory."""
        path = Path(v) if isinstance(v, str) else v
        if not path.exists():
            raise ValueError(f"Base path does not exist: {path}")
        if not path.is_dir():
            raise ValueError(f"Base path is not a directory: {path}")
        return path.resolve()  # Convert to absolute path
    
    @validator('groups')
    def validate_groups(cls, v: List[GroupConfig]) -> List[GroupConfig]:
        """Validate that group names are unique within this server."""
        names = [group.name for group in v]
        if len(names) != len(set(names)):
            raise ValueError("Group names must be unique within a server")
        return v


class AppConfig(BaseModel):
    """Main application configuration."""
    
    servers: List[ServerConfig] = Field(
        default_factory=list,
        description="List of server configurations"
    )
    cors: CORSConfig = Field(
        default_factory=CORSConfig,
        description="CORS configuration"
    )
    
    @validator('servers')
    def validate_servers(cls, v: List[ServerConfig]) -> List[ServerConfig]:
        """Validate that server IDs are unique."""
        if not v:
            raise ValueError("At least one server must be configured")
        ids = [server.id for server in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Server IDs must be unique")
        return v


def load_config(config_path: Optional[Path] = None) -> AppConfig:
    """Load configuration from JSON file.
    
    Args:
        config_path: Path to the configuration file. If None, looks for config.json
                    in the package directory.
    
    Returns:
        Loaded application configuration
    
    Raises:
        FileNotFoundError: If config file is not found
        ValueError: If config file is invalid
    """
    if config_path is None:
        # Look for config.json in the package directory
        package_dir = Path(__file__).parent.parent
        config_path = package_dir / "config.json"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return AppConfig(**data)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in configuration file: {e}")
    except Exception as e:
        raise ValueError(f"Invalid configuration: {e}")


# Legacy compatibility - use the first server as default
def _get_default_server() -> ServerConfig:
    """Get the default server configuration for legacy compatibility."""
    if not app_config.servers:
        raise ValueError("No servers configured")
    return app_config.servers[0]


# Global configuration instance
app_config = load_config()
settings = _get_default_server()  # For backward compatibility


def file_matches_group(file_path: str, group: GroupConfig) -> bool:
    """Check if a file path matches a group's pattern.
    
    Args:
        file_path: Relative path from base_path to check
        group: Group configuration to match against
        
    Returns:
        True if file matches the group pattern, False otherwise
    """
    return bool(re.match(group.pattern, file_path))


def get_user_groups(username: str, server_id: Optional[str] = None) -> List[str]:
    """Get list of group names that a user has access to.
    
    Args:
        username: The username to check access for
        server_id: Server ID to get groups for. If None, uses default server.
        
    Returns:
        List of group names the user can access
    """
    server = _get_server_by_id(server_id) if server_id else settings
    return [group.name for group in server.groups if username in group.users]


def get_group_by_name(group_name: str, server_id: Optional[str] = None) -> Optional[GroupConfig]:
    """Get group configuration by name.
    
    Args:
        group_name: Name of the group to retrieve
        server_id: Server ID to get groups for. If None, uses default server.
        
    Returns:
        GroupConfig if found, None otherwise
    """
    server = _get_server_by_id(server_id) if server_id else settings
    for group in server.groups:
        if group.name == group_name:
            return group
    return None


def get_accessible_groups_for_file(username: str, file_path: str, server_id: Optional[str] = None) -> List[str]:
    """Get list of groups that both match the file and are accessible to the user.
    
    Args:
        username: Username to check access for
        file_path: Relative file path from base_path
        server_id: Server ID to get groups for. If None, uses default server.
        
    Returns:
        List of group names that match the file and are accessible to the user
    """
    user_groups = get_user_groups(username, server_id)
    matching_groups = []
    
    for group_name in user_groups:
        group = get_group_by_name(group_name, server_id)
        if group and file_matches_group(file_path, group):
            matching_groups.append(group_name)
    
    return matching_groups


def _get_server_by_id(server_id: str) -> ServerConfig:
    """Get server configuration by ID.
    
    Args:
        server_id: ID of the server to retrieve
        
    Returns:
        ServerConfig if found
        
    Raises:
        ValueError: If server ID is not found
    """
    for server in app_config.servers:
        if server.id == server_id:
            return server
    raise ValueError(f"Server not found: {server_id}")


def get_all_servers() -> List[ServerConfig]:
    """Get all configured servers.
    
    Returns:
        List of all server configurations
    """
    return app_config.servers