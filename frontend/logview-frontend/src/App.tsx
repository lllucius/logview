import React, { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { FileList } from './components/FileList';
import { FileViewer } from './components/FileViewer';
import { FileTail } from './components/FileTail';
import { FileWithServer } from './types';
import { LogViewAPI } from './api';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Default server configuration - get from backend
const defaultServer = {
  id: 'default',
  name: 'Log Server',
  url: window.location.origin, // Use same origin as the frontend
  username: 'admin', // This should come from authentication
};

function App() {
  const [files, setFiles] = useState<FileWithServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [tailOpen, setTailOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithServer | null>(null);
  const [api] = useState<LogViewAPI>(new LogViewAPI(defaultServer));

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filesResponse = await api.getFiles();
      const filesWithServer: FileWithServer[] = filesResponse.files.map(file => ({
        ...file,
        server: defaultServer,
      }));

      setFiles(filesWithServer);
    } catch (err) {
      console.error('Failed to load files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Load files on startup
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDownload = async (file: FileWithServer) => {
    try {
      const blob = await api.downloadFile(file.name); // Use name instead of path since path was removed
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    }
  };

  const handleView = (file: FileWithServer) => {
    setSelectedFile(file);
    setViewerOpen(true);
  };

  const handleTail = (file: FileWithServer) => {
    setSelectedFile(file);
    setTailOpen(true);
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* Only show main UI when not in viewer/tail mode */}
      {!viewerOpen && !tailOpen && (
        <>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                LogView - Log File Viewer
              </Typography>
              <Button
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={loadFiles}
                disabled={loading}
              >
                Refresh
              </Button>
            </Toolbar>
          </AppBar>

          <Container maxWidth="xl" sx={{ mt: 2 }}>
            <Box mb={2}>
              <Typography variant="h5" gutterBottom>
                Log Files ({files.length})
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Files available on server: {files.length}
              </Typography>
            </Box>

            <FileList
              files={files}
              onDownload={handleDownload}
              onView={handleView}
              onTail={handleTail}
              loading={loading}
            />
          </Container>
        </>
      )}

      <FileViewer
        file={selectedFile}
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setSelectedFile(null);
        }}
      />

      <FileTail
        file={selectedFile}
        open={tailOpen}
        onClose={() => {
          setTailOpen(false);
          setSelectedFile(null);
        }}
      />

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        message={error}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
