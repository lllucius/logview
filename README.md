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

Set environment variables or create a `.env` file:

```bash
# Base path where all log files are located
LOGVIEW_BASE_PATH=/var/log

# Server configuration
LOGVIEW_HOST=0.0.0.0
LOGVIEW_PORT=8000

# Authentication header (contains the username)
LOGVIEW_AUTH_HEADER=X-User
```

### Running the Application

```bash
# Start the application
python -m logview.main

# Or with custom configuration
LOGVIEW_BASE_PATH=/var/log python -m logview.main
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

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGVIEW_BASE_PATH` | `/var/log` | Base directory for all file operations |
| `LOGVIEW_HOST` | `0.0.0.0` | Server host |
| `LOGVIEW_PORT` | `8000` | Server port |
| `LOGVIEW_AUTH_HEADER` | `X-User` | HTTP header containing username |
| `LOGVIEW_MAX_FILE_SIZE` | `104857600` | Maximum file size (100MB) |
| `LOGVIEW_DEFAULT_PAGE_SIZE` | `1000` | Default pagination size |
| `LOGVIEW_MAX_PAGE_SIZE` | `10000` | Maximum pagination size |

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