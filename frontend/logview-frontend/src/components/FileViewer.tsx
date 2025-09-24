import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Paper,
  Pagination,
  TextField,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { FileWithServer, FileContentResponse } from '../types';
import { LogViewAPI } from '../api';

interface FileViewerProps {
  file: FileWithServer | null;
  open: boolean;
  onClose: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ file, open, onClose }) => {
  const [content, setContent] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [api, setApi] = useState<LogViewAPI | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (file) {
      setApi(new LogViewAPI(file.server));
      setCurrentPage(1);
      setContent(null);
      setError(null);
    }
  }, [file]);

  const loadContent = useCallback(async () => {
    if (!api || !file) return;

    setLoading(true);
    setError(null);

    try {
      const startLine = (currentPage - 1) * pageSize + 1;
      const response = await api.getFileContent(file.path, startLine, pageSize);
      setContent(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content');
    } finally {
      setLoading(false);
    }
  }, [api, file, currentPage, pageSize]);

  useEffect(() => {
    if (api && file && open) {
      loadContent();
    }
  }, [api, file, open, loadContent]);

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(event.target.value);
    if (newSize > 0 && newSize <= 1000) {
      setPageSize(newSize);
      setCurrentPage(1);
    }
  };

  const handleRefresh = () => {
    loadContent();
  };

  const totalPages = content ? Math.ceil(content.total_lines / pageSize) : 0;

  if (!open || !file) return null;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onClose}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              {file.server.name} : {file.name}
            </Typography>
          </Box>
          
          <TextField
            label="Page Size"
            type="number"
            value={pageSize}
            onChange={handlePageSizeChange}
            size="small"
            inputProps={{ min: 1, max: 1000 }}
            sx={{ 
              width: 120,
              mr: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.7)',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
              '& .MuiOutlinedInput-input': {
                color: 'white',
              },
            }}
          />
          
          {content && (
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', mr: 2, fontSize: '0.875rem' }}>
              Lines {content.start_line}-{content.start_line + content.content.length - 1} of {content.total_lines}
            </Typography>
          )}

          <IconButton color="inherit" onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
            <Typography>Loading...</Typography>
          </Box>
        )}

        {error && (
          <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {content && !loading && !error && (
          <Paper
            sx={{
              flex: 1,
              m: 1,
              p: 1,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
              overflow: 'auto',
            }}
          >
            {content.content.map((line, index) => (
              <Box key={index} sx={{ whiteSpace: 'pre-wrap', mb: 0.25 }}>
                <Typography
                  component="span"
                  sx={{
                    color: 'text.secondary',
                    mr: 1.5,
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                    minWidth: '4ch',
                    display: 'inline-block',
                  }}
                >
                  {content.start_line + index}:
                </Typography>
                <Typography
                  component="span"
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
        )}
      </Box>

      {content && totalPages > 1 && (
        <Box sx={{ borderTop: 1, borderColor: 'divider', py: 1, display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
            size="small"
          />
        </Box>
      )}
    </Box>
  );
};
