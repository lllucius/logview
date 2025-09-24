import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
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
  IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import { FileList } from './components/FileList';
import { FileViewer } from './components/FileViewer';
import { FileTail } from './components/FileTail';
import { FileWithServer, ServerConfig } from './types';
import { LogViewAPI } from './api';
import { getDefaultServer } from './config';

// Theme context for sharing theme state
interface ThemeContextType {
  darkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage for saved theme preference
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [files, setFiles] = useState<FileWithServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [tailOpen, setTailOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithServer | null>(null);
  const [server, setServer] = useState<ServerConfig | null>(null);
  const [api, setApi] = useState<LogViewAPI | null>(null);

  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
  };

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
    typography: {
      fontSize: 13, // Make text more compact
    },
    components: {
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '8px 16px', // More compact table cells
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            height: 48, // More compact row height
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          dense: {
            minHeight: 40, // More compact toolbar
          },
        },
      },
    },
  });

  // Load configuration on startup
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const defaultServer = await getDefaultServer();
        setServer(defaultServer);
        setApi(new LogViewAPI(defaultServer));
      } catch (err) {
        console.error('Failed to load configuration:', err);
        setError('Failed to load application configuration');
      } finally {
        setInitializing(false);
      }
    };

    initializeConfig();
  }, []);

  const loadFiles = useCallback(async () => {
    if (!api) return;

    setLoading(true);
    setError(null);

    try {
      const filesResponse = await api.getFiles();
      const filesWithServer: FileWithServer[] = filesResponse.files.map(file => ({
        ...file,
        server: server!,
      }));

      setFiles(filesWithServer);
    } catch (err) {
      console.error('Failed to load files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [api, server]);

  // Load files when api is ready
  useEffect(() => {
    if (api && server) {
      loadFiles();
    }
  }, [loadFiles, api, server]);

  const handleDownload = async (file: FileWithServer) => {
    if (!api) return;
    
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
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        
        {/* Show loading during initialization */}
        {initializing && (
          <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              LogView - Log File Viewer
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Loading configuration...
            </Typography>
          </Container>
        )}
        
        {/* Show error if configuration failed to load */}
        {!initializing && error && !server && (
          <Container maxWidth="md" sx={{ mt: 8 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Typography variant="body2" color="textSecondary">
              Please check the application configuration.
            </Typography>
          </Container>
        )}
        
        {/* Only show main UI when not in viewer/tail mode and config is loaded */}
        {!initializing && server && !viewerOpen && !tailOpen && (
          <>
            <AppBar position="static">
              <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                  LogView - Log File Viewer
                </Typography>
                <IconButton
                  color="inherit"
                  onClick={toggleTheme}
                  sx={{ mr: 2 }}
                >
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
                <Button
                  color="inherit"
                  startIcon={<RefreshIcon />}
                  onClick={loadFiles}
                  disabled={loading || !api}
                >
                  Refresh
                </Button>
              </Toolbar>
            </AppBar>

            <Container maxWidth="xl" sx={{ mt: 1, px: 1 }}>
              <Box mb={1}>
                <Typography variant="h6" gutterBottom>
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
    </ThemeContext.Provider>
  );
}

export default App;
