import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,

  Box,
  Typography,
  Paper,
  Pagination,
  TextField,
  IconButton,
  Toolbar,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
              {file?.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {file?.server.name} - {file?.path}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <Toolbar variant="dense">
        <Box display="flex" alignItems="center" gap={2} width="100%">
          <TextField
            label="Page Size"
            type="number"
            value={pageSize}
            onChange={handlePageSizeChange}
            size="small"
            inputProps={{ min: 1, max: 1000 }}
            sx={{ width: 120 }}
          />
          
          {content && (
            <Typography variant="body2" color="textSecondary">
              Lines {content.start_line}-{content.start_line + content.content.length - 1} of {content.total_lines}
            </Typography>
          )}

          <Box flex={1} />

          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Toolbar>

      <Divider />

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
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
              p: 2,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              backgroundColor: '#f5f5f5',
              overflow: 'auto',
            }}
          >
            {content.content.map((line, index) => (
              <Box key={index} sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
                <Typography
                  component="span"
                  sx={{
                    color: 'text.secondary',
                    mr: 2,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                >
                  {content.start_line + index}:
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  }}
                >
                  {line}
                </Typography>
              </Box>
            ))}
          </Paper>
        )}
      </DialogContent>

      {content && totalPages > 1 && (
        <>
          <Divider />
          <DialogActions sx={{ justifyContent: 'center', py: 2 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
            />
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};