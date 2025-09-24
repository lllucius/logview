import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,

  TableSortLabel,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  PlayArrow as TailIcon,
} from '@mui/icons-material';
import { FileWithServer, SortField, SortDirection } from '../types';

interface FileListProps {
  files: FileWithServer[];
  onDownload: (file: FileWithServer) => void;
  onView: (file: FileWithServer) => void;
  onTail: (file: FileWithServer) => void;
  loading?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onDownload,
  onView,
  onTail,
  loading,
}) => {
  const [sortField, setSortField] = useState<SortField>('server');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sortedFiles, setSortedFiles] = useState<FileWithServer[]>([]);

  useEffect(() => {
    const sorted = [...files].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'server':
          aValue = a.server.name;
          bValue = b.server.name;
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'modified_time':
          aValue = a.modified_time;
          bValue = b.modified_time;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return 0;
    });

    setSortedFiles(sorted);
  }, [files, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <Typography>Loading files...</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <TableSortLabel
                active={sortField === 'server'}
                direction={sortField === 'server' ? sortDirection : 'asc'}
                onClick={() => handleSort('server')}
              >
                Server
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'name'}
                direction={sortField === 'name' ? sortDirection : 'asc'}
                onClick={() => handleSort('name')}
              >
                File Name
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'size'}
                direction={sortField === 'size' ? sortDirection : 'asc'}
                onClick={() => handleSort('size')}
              >
                Size
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sortField === 'modified_time'}
                direction={sortField === 'modified_time' ? sortDirection : 'asc'}
                onClick={() => handleSort('modified_time')}
              >
                Modified
              </TableSortLabel>
            </TableCell>
            <TableCell>Path</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedFiles.map((file, index) => (
            <TableRow key={`${file.server?.id || 'unknown'}-${file.path || file.name || index}`} hover>
              <TableCell>
                <Chip label={file.server.name} color="primary" size="small" />
              </TableCell>
              <TableCell>{file.name}</TableCell>
              <TableCell>{formatSize(file.size)}</TableCell>
              <TableCell>{formatDate(file.modified_time)}</TableCell>
              <TableCell>
                <Typography variant="body2" color="textSecondary">
                  {file.path}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Box display="flex" gap={1} justifyContent="center">
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      onClick={() => onDownload(file)}
                      color="primary"
                    >
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View">
                    <IconButton
                      size="small"
                      onClick={() => onView(file)}
                      color="secondary"
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Tail">
                    <IconButton
                      size="small"
                      onClick={() => onTail(file)}
                      color="success"
                    >
                      <TailIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sortedFiles.length === 0 && (
        <Box display="flex" justifyContent="center" p={4}>
          <Typography color="textSecondary">
            No files found. Check your server configurations and user permissions.
          </Typography>
        </Box>
      )}
    </TableContainer>
  );
};