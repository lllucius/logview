import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Paper,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Clear as ClearIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
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
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const disconnectFromTail = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  const connectToTail = useCallback(() => {
    if (!file) return;

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
        if (!isPaused) {
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
  }, [file, isPaused]);

  useEffect(() => {
    if (open && file && !isPaused) {
      connectToTail();
    } else {
      disconnectFromTail();
    }

    return () => {
      disconnectFromTail();
    };
  }, [open, file, isPaused, connectToTail]);

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

  const handleAutoScrollToggle = () => {
    setAutoScroll(!autoScroll);
  };

  const handleClose = () => {
    disconnectFromTail();
    setLines([]);
    setError(null);
    setIsPaused(false);
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

      <Toolbar variant="dense" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          <IconButton onClick={handlePauseToggle} disabled={!isConnected}>
            {isPaused ? <PlayIcon /> : <PauseIcon />}
          </IconButton>

          <IconButton onClick={handleClear}>
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
          />

          <Box flex={1} />

          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isConnected ? 'success.main' : 'error.main',
              }}
            />
            <Typography variant="body2" color="textSecondary">
              ({lines.length} lines)
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
            m: 2,
            p: 2,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            overflow: 'auto',
          }}
        >
          {lines.length === 0 && !error && (
            <Typography color="textSecondary" sx={{ fontFamily: 'monospace' }}>
              Waiting for new lines...
            </Typography>
          )}

          {lines.map((line, index) => (
            <Box key={index} sx={{ whiteSpace: 'pre-wrap', mb: 0.25 }}>
              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  color: '#ffffff',
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
};