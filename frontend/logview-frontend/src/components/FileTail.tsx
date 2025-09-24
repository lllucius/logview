import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Paper,
  Switch,
  FormControlLabel,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Clear as ClearIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { FileWithServer } from '../types';

interface FileTailProps {
  file: FileWithServer | null;
  open: boolean;
  onClose: () => void;
}

export const FileTail: React.FC<FileTailProps> = ({ file, open, onClose }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const disconnectFromTail = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  const loadInitialLines = useCallback(async () => {
    if (!file || hasInitialLoad) return;

    try {
      // Calculate approximate lines needed to fill the viewer
      const viewerHeight = contentRef.current?.clientHeight || 500;
      const lineHeight = 20; // Approximate line height in pixels
      const linesToLoad = Math.max(50, Math.floor(viewerHeight / lineHeight));
      
      // First, get the file info to determine total lines
      const response = await fetch(
        `${file.server.url}/files/${file.path}/content?start_line=1&page_size=1&user=${encodeURIComponent(file.server.username)}`
      );
      
      if (response.ok) {
        const contentData = await response.json();
        const totalLines = contentData.total_lines || 0;
        
        if (totalLines > 0) {
          // Calculate start line to get the last N lines
          const startLine = Math.max(1, totalLines - linesToLoad + 1);
          
          // Fetch the last lines
          const tailResponse = await fetch(
            `${file.server.url}/files/${file.path}/content?start_line=${startLine}&page_size=${linesToLoad}&user=${encodeURIComponent(file.server.username)}`
          );
          
          if (tailResponse.ok) {
            const tailData = await tailResponse.json();
            if (tailData.content && Array.isArray(tailData.content)) {
              setLines(tailData.content);
              setHasInitialLoad(true);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load initial lines:', err);
    }
  }, [file, hasInitialLoad]);

  const connectToTail = useCallback(() => {
    if (!file || isStopped) return;

    disconnectFromTail();

    try {
      // Note: EventSource doesn't support custom headers directly
      // For now, we'll include the username in the URL as a parameter
      const url = `${file.server.url}/files/${file.path}/tail?user=${encodeURIComponent(file.server.username)}`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        if (!isPaused && !isStopped) {
          try {
            const line = JSON.parse(event.data);
            setLines((prevLines) => [...prevLines, line]);
          } catch (err) {
            // If it's not JSON, treat as plain text
            setLines((prevLines) => [...prevLines, event.data]);
          }
        }
      };

      eventSource.onerror = (event) => {
        setError('Connection to tail stream lost');
        setIsConnected(false);
        eventSource.close();
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to tail stream');
    }
  }, [file, isPaused, isStopped]);

  useEffect(() => {
    if (open && file && !isStopped) {
      loadInitialLines().then(() => {
        if (!isPaused) {
          connectToTail();
        }
      });
    } else {
      disconnectFromTail();
    }

    return () => {
      disconnectFromTail();
    };
  }, [open, file, isPaused, isStopped, connectToTail, loadInitialLines]);

  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleClear = () => {
    setLines([]);
  };

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsStopped(true);
    disconnectFromTail();
  };

  const handleRestart = () => {
    setIsStopped(false);
    setIsPaused(false);
    setHasInitialLoad(false);
    setLines([]);
    setError(null);
  };

  const handleAutoScrollToggle = () => {
    setAutoScroll(!autoScroll);
  };

  const handleClose = () => {
    disconnectFromTail();
    setLines([]);
    setError(null);
    setIsPaused(false);
    setIsStopped(false);
    setHasInitialLoad(false);
    onClose();
  };

  if (!open || !file) return null;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleClose}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              Tail: {file.name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {file.server.name} | Status: {isConnected ? 'Connected' : 'Disconnected'}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Toolbar variant="dense" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
        <Box display="flex" alignItems="center" gap={1} width="100%">
          {!isStopped ? (
            <IconButton onClick={handlePauseToggle} disabled={!isConnected} size="small">
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>
          ) : (
            <IconButton onClick={handleRestart} size="small" color="primary">
              <PlayIcon />
            </IconButton>
          )}

          <IconButton onClick={handleStop} disabled={isStopped} size="small">
            <StopIcon />
          </IconButton>

          <IconButton onClick={handleClear} size="small">
            <ClearIcon />
          </IconButton>

          <FormControlLabel
            control={
              <Switch
                checked={autoScroll}
                onChange={handleAutoScrollToggle}
                size="small"
              />
            }
            label="Auto Scroll"
            sx={{ fontSize: '0.875rem' }}
          />

          <Box flex={1} />

          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isConnected && !isStopped ? 'success.main' : 'error.main',
              }}
            />
            <Typography variant="body2" color="textSecondary" fontSize="0.75rem">
              {isStopped ? 'Stopped' : isConnected ? 'Connected' : 'Disconnected'} ({lines.length} lines)
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <Box p={2} bgcolor="error.light" color="error.contrastText">
            <Typography>{error}</Typography>
          </Box>
        )}

        <Paper
          ref={contentRef}
          sx={{
            flex: 1,
            m: 1,
            p: 1,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
            color: theme.palette.text.primary,
            overflow: 'auto',
          }}
        >
          {lines.length === 0 && !error && (
            <Typography color="textSecondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {isStopped ? 'Tail stopped. Click play to restart.' : 'Waiting for new lines...'}
            </Typography>
          )}

          {lines.map((line, index) => (
            <Box key={index} sx={{ whiteSpace: 'pre-wrap', mb: 0.125 }}>
              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                }}
              >
                {line}
              </Typography>
            </Box>
          ))}
        </Paper>
      </Box>
    </Box>
  );
};
