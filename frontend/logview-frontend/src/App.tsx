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
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { FileList } from './components/FileList';
import { FileViewer } from './components/FileViewer';
import { FileTail } from './components/FileTail';
import { ServerConfigDialog } from './components/ServerConfig';
import { FileWithServer, ServerConfig } from './types';
import { MultiServerAPI } from './api';

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

function App() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [files, setFiles] = useState<FileWithServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [tailOpen, setTailOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithServer | null>(null);
  const [multiAPI, setMultiAPI] = useState<MultiServerAPI>(new MultiServerAPI());

  // Load servers from localStorage on startup
  useEffect(() => {
    const savedServers = localStorage.getItem('logview-servers');
    if (savedServers) {
      try {
        const parsedServers = JSON.parse(savedServers);
        setServers(parsedServers);
      } catch (err) {
        console.error('Failed to load saved servers:', err);
      }
    } else {
      // Set default server for development
      const defaultServers: ServerConfig[] = [
        {
          id: 'default',
          name: 'Local Server',
          url: 'http://localhost:8000',
          username: 'admin',
        }
      ];
      setServers(defaultServers);
    }
  }, []);

  // Update MultiServerAPI when servers change
  useEffect(() => {
    const newMultiAPI = new MultiServerAPI();
    servers.forEach(server => {
      newMultiAPI.addServer(server);
    });
    setMultiAPI(newMultiAPI);
    
    // Save servers to localStorage
    localStorage.setItem('logview-servers', JSON.stringify(servers));
  }, [servers]);

  const loadFiles = useCallback(async () => {
    if (servers.length === 0) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await multiAPI.getAllFiles();
      const allFiles: FileWithServer[] = [];

      results.forEach(({ server, files }) => {
        files.files.forEach(file => {
          allFiles.push({
            ...file,
            server,
          });
        });
      });

      setFiles(allFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [multiAPI, servers.length]);

  // Load files when servers change
  useEffect(() => {
    if (servers.length > 0) {
      loadFiles();
    }
  }, [servers.length, loadFiles]); // Fixed dependencies

  const handleDownload = async (file: FileWithServer) => {
    try {
      const api = multiAPI.getAPI(file.server.id);
      if (!api) {
        throw new Error('Server API not found');
      }

      const blob = await api.downloadFile(file.path);
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
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            LogView - Multi-Server Log File Viewer
          </Typography>
          <Button
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={loadFiles}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            color="inherit"
            startIcon={<SettingsIcon />}
            onClick={() => setConfigOpen(true)}
          >
            Servers
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2 }}>
        <Box mb={2}>
          <Typography variant="h5" gutterBottom>
            Log Files ({files.length})
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Configured servers: {servers.length} | 
            Files found across all servers: {files.length}
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

      <ServerConfigDialog
        servers={servers}
        onServersChange={setServers}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />

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
