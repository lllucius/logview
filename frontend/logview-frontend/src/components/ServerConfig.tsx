import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { ServerConfig } from '../types';

interface ServerConfigProps {
  servers: ServerConfig[];
  onServersChange: (servers: ServerConfig[]) => void;
  open: boolean;
  onClose: () => void;
}

export const ServerConfigDialog: React.FC<ServerConfigProps> = ({
  servers,
  onServersChange,
  open,
  onClose,
}) => {
  const [editingServer, setEditingServer] = useState<ServerConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    username: '',
  });

  const handleStartEdit = (server: ServerConfig) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      url: server.url,
      username: server.username,
    });
    setIsAddingNew(false);
  };

  const handleStartAdd = () => {
    setEditingServer(null);
    setFormData({
      name: '',
      url: '',
      username: '',
    });
    setIsAddingNew(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.url.trim() || !formData.username.trim()) {
      return;
    }

    const newServer: ServerConfig = {
      id: editingServer?.id || `server-${Date.now()}`,
      name: formData.name.trim(),
      url: formData.url.trim().replace(/\/$/, ''), // Remove trailing slash  
      username: formData.username.trim(),
    };

    let updatedServers;
    if (editingServer) {
      updatedServers = servers.map(s => s.id === editingServer.id ? newServer : s);
    } else {
      updatedServers = [...servers, newServer];
    }

    onServersChange(updatedServers);
    handleCancel();
  };

  const handleCancel = () => {
    setEditingServer(null);
    setIsAddingNew(false);
    setFormData({
      name: '',
      url: '',
      username: '',
    });
  };

  const handleDelete = (serverId: string) => {
    const updatedServers = servers.filter(s => s.id !== serverId);
    onServersChange(updatedServers);
  };

  const handleFieldChange = (field: keyof typeof formData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Server Configuration
      </DialogTitle>

      <DialogContent>
        <Box mb={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleStartAdd}
            disabled={isAddingNew || editingServer !== null}
          >
            Add Server
          </Button>
        </Box>

        {(isAddingNew || editingServer) && (
          <Box mb={3} p={2} border={1} borderColor="grey.300" borderRadius={1}>
            <Typography variant="h6" gutterBottom>
              {isAddingNew ? 'Add New Server' : 'Edit Server'}
            </Typography>
            
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                label="Server Name"
                value={formData.name}
                onChange={handleFieldChange('name')}
                fullWidth
                required
                placeholder="e.g., Production Server"
              />
              
              <TextField
                label="Server URL"
                value={formData.url}
                onChange={handleFieldChange('url')}
                fullWidth
                required
                placeholder="e.g., http://localhost:8000"
              />
              
              <TextField
                label="Username"
                value={formData.username}
                onChange={handleFieldChange('username')}
                fullWidth
                required
                placeholder="e.g., admin"
              />
              
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Button onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!formData.name.trim() || !formData.url.trim() || !formData.username.trim()}
                >
                  Save
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        <Typography variant="h6" gutterBottom>
          Configured Servers ({servers.length})
        </Typography>
        
        {servers.length === 0 ? (
          <Typography color="textSecondary">
            No servers configured. Add a server to get started.
          </Typography>
        ) : (
          <List>
            {servers.map((server, index) => (
              <React.Fragment key={server.id}>
                <ListItem>
                  <ListItemText
                    primary={server.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          URL: {server.url}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          User: {server.username}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleStartEdit(server)}
                      disabled={isAddingNew || editingServer !== null}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => handleDelete(server.id)}
                      disabled={isAddingNew || editingServer !== null}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < servers.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};