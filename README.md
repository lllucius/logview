# LogView

FastAPI application for remote log file viewing with group-based access control.

## Features

- **Secure File Access**: All file operations are anchored to a configurable base path
- **Group-Based Authorization**: Regex-based file grouping with per-user access control
- **RESTful API**: Full OpenAPI documentation with comprehensive endpoints
- **Real-time Tailing**: Server-Sent Events (SSE) for live log monitoring
- **Pagination Support**: Handle large files efficiently with pagination
- **Docker Ready**: Containerized deployment with docker-compose

## Quick Start

### Installation

```bash
pip install -e .
```

### Configuration

LogView now uses JSON configuration instead of environment variables. Create a `config.json` file in the project root directory with your server configuration.

#### Configuration File Structure

```json
{
  "servers": [
    {
      "id": "default",
      "name": "Local Server",
      "host": "0.0.0.0",
      "port": 8000,
      "base_path": "/var/log",
      "auth_header": "X-User",
      "max_file_size": 104857600,
      "default_page_size": 1000,
      "max_page_size": 10000,
      "tail_buffer_size": 1024,
      "tail_check_interval": 1.0,
      "groups": [
        {
          "name": "system",
          "pattern": "^(syslog|messages|auth\\.log|kern\\.log).*",
          "description": "System log files",
          "users": ["admin"]
        },
        {
          "name": "application",
          "pattern": "^app/.*\\.log$",
          "description": "Application log files",
          "users": ["developer", "admin"]
        }
      ]
    }
  ],
  "cors": {
    "allow_origins": ["*"],
    "allow_credentials": true,
    "allow_methods": ["*"],
    "allow_headers": ["*"]
  }
}
```

#### Configuration Options

**Server Configuration:**
- `id`: Unique identifier for the server
- `name`: Display name for the server
- `host`: Host to bind the server to (default: "0.0.0.0")
- `port`: Port to bind the server to (default: 8000)
- `base_path`: Base directory for all file operations
- `auth_header`: HTTP header containing username (default: "X-User")
- `max_file_size`: Maximum file size in bytes (default: 100MB)
- `default_page_size`: Default pagination size (default: 1000)
- `max_page_size`: Maximum pagination size (default: 10000)
- `tail_buffer_size`: Buffer size for tail operations (default: 1024)
- `tail_check_interval`: Interval between file checks for tail operations in seconds (default: 1.0)

**Group Configuration:**
Each server can have multiple groups with different access patterns:
- `name`: Name of the group
- `pattern`: Regular expression pattern to match files
- `description`: Description of what files this group covers
- `users`: Array of usernames that have access to this group

**CORS Configuration:**
- `allow_origins`: Array of allowed origins for CORS
- `allow_credentials`: Whether to allow credentials in CORS requests
- `allow_methods`: Array of allowed HTTP methods
- `allow_headers`: Array of allowed HTTP headers

### Running the Application

```bash
# Start the application (looks for config.json in project root)
python -m logview.main

# The configuration file location is automatically detected
```

### Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up -d
```

## API Endpoints

### Authentication

All endpoints require authentication via HTTP header (default: `X-User`):

```bash
curl -H "X-User: admin" http://localhost:8000/files
```

### Core Endpoints

- `GET /` - Application information
- `GET /health` - Health check
- `GET /user` - Current user information and groups
- `GET /config/groups` - Available groups and access information

### File Operations

- `GET /files` - List accessible files in root directory
- `GET /files?directory=path` - List files in specific directory
- `GET /files/{path}` - Get file content with pagination
- `GET /files/{path}?start_line=N&page_size=M` - Paginated file content
- `GET /files/{path}/tail` - Real-time file tailing (Server-Sent Events)

### Example Usage

```bash
# List files
curl -H "X-User: admin" http://localhost:8000/files

# Get file content
curl -H "X-User: admin" http://localhost:8000/files/syslog

# Get paginated content
curl -H "X-User: admin" "http://localhost:8000/files/syslog?start_line=100&page_size=50"

# Tail a file (real-time)
curl -H "X-User: admin" -H "Accept: text/event-stream" \
     http://localhost:8000/files/syslog/tail
```

## Configuration

### Group-Based Access Control

The application uses regex patterns to group files and control access:

```python
# Example group configuration (in logview/config.py)
groups = [
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
]
```

## Development

### Testing

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run the test API
python test_api.py
```

### API Documentation

Visit `http://localhost:8000/docs` for interactive OpenAPI documentation.

## Security

- All file paths are validated and restricted to the configured base path
- Directory traversal attacks are prevented
- User authorization is enforced for all file operations
- Only users with group access can view matching files
- No direct file system access outside the base path