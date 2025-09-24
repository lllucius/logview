import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,

  Box,
  Typography,
  Paper,
  IconButton,
  Toolbar,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" component="div">
              Tail: {file?.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {file?.server.name} - {file?.path}
            </Typography>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <Toolbar variant="dense">
        <Box display="flex" alignItems="center" gap={2} width="100%">
          <IconButton onClick={handlePauseToggle} color={isPaused ? 'primary' : 'default'}>
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
              {isConnected ? 'Connected' : 'Disconnected'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              ({lines.length} lines)
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Divider />

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
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
      </DialogContent>
    </Dialog>
  );
};