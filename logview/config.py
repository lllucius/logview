"""Configuration management for LogView application."""

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator, model_validator


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
    allow_credentials: bool = Field(default=False, description="Allow credentials in CORS requests")
    allow_methods: List[str] = Field(default=["*"], description="Allowed HTTP methods")
    allow_headers: List[str] = Field(default=["*"], description="Allowed HTTP headers")
    
    @model_validator(mode='after')
    def validate_cors_configuration(self):
        """Validate CORS configuration for security compliance."""
        if self.allow_credentials and "*" in self.allow_origins:
            raise ValueError(
                "Cannot use 'allow_origins: [\"*\"]' with 'allow_credentials: true'. "
                "Specify exact origins like ['http://localhost:3000'] or set 'allow_credentials: false'."
            )
        return self


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


class BackendConfig(BaseModel):
    """Backend configuration with groups for authorization."""
    
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
    
    # File group configurations for authorization
    groups: List[GroupConfig] = Field(
        default_factory=list,
        description="List of file groups with access control"
    )
    
    cors: CORSConfig = Field(
        default_factory=CORSConfig,
        description="CORS configuration"
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
        """Validate that group names are unique."""
        names = [group.name for group in v]
        if len(names) != len(set(names)):
            raise ValueError("Group names must be unique")
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


def load_backend_config(config_path: Optional[Path] = None) -> BackendConfig:
    """Load backend configuration from JSON file.
    
    Args:
        config_path: Path to the configuration file. If None, looks for backend-config.json
                    in the package directory.
    
    Returns:
        Loaded backend configuration
    
    Raises:
        FileNotFoundError: If config file is not found
        ValueError: If config file is invalid
    """
    if config_path is None:
        # Look for backend-config.json in the package directory
        package_dir = Path(__file__).parent.parent
        config_path = package_dir / "backend-config.json"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return BackendConfig(**data)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in configuration file: {e}")
    except Exception as e:
        raise ValueError(f"Invalid configuration: {e}")


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


# Global configuration instance - use only backend config
backend_config = load_backend_config()
settings = backend_config  # Use backend config as operational settings


def file_matches_group(file_path: str, group: GroupConfig) -> bool:
    """Check if a file path matches a group's pattern.
    
    Args:
        file_path: Relative path from base_path to check
        group: Group configuration to match against
        
    Returns:
        True if file matches the group pattern, False otherwise
    """
    return bool(re.match(group.pattern, file_path))


def get_user_groups(username: str) -> List[str]:
    """Get list of group names that a user has access to.
    
    Args:
        username: The username to check access for
        
    Returns:
        List of group names the user can access
    """
    return [group.name for group in backend_config.groups if username in group.users]


def get_group_by_name(group_name: str) -> Optional[GroupConfig]:
    """Get group configuration by name.
    
    Args:
        group_name: Name of the group to retrieve
        
    Returns:
        GroupConfig if found, None otherwise
    """
    for group in backend_config.groups:
        if group.name == group_name:
            return group
    return None


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