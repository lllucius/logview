// Configuration loading utility for the frontend

import { FrontendConfig, ServerConfig, FullServerConfig } from './types';

let configCache: FrontendConfig | null = null;

/**
 * Convert a full server config to the simplified ServerConfig used by the API client
 */
function convertToServerConfig(fullServer: FullServerConfig): ServerConfig {
  // Build URL from host and port
  const protocol = 'http'; // Could be configurable in the future
  const url = `${protocol}://${fullServer.host === '0.0.0.0' ? 'localhost' : fullServer.host}:${fullServer.port}`;
  
  return {
    id: fullServer.id,
    name: fullServer.name,
    url: url,
    username: 'admin' // This should ideally come from authentication
  };
}

/**
 * Load the frontend configuration from /config.json (static file)
 * @returns Promise<FrontendConfig>
 */
export async function loadConfig(): Promise<FrontendConfig> {
  if (configCache) {
    return configCache;
  }

  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    
    configCache = await response.json();
    return configCache as FrontendConfig;
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    
    // Fallback to hardcoded config if loading fails
    const fallbackConfig: FrontendConfig = {
      servers: [
        {
          id: 'default',
          name: 'Local Server',
          host: 'localhost',
          port: 8000,
          base_path: '/var/log',
          auth_header: 'X-User',
          max_file_size: 104857600,
          default_page_size: 1000,
          max_page_size: 10000,
          tail_buffer_size: 1024,
          tail_check_interval: 1.0,
          groups: []
        }
      ]
    };
    
    configCache = fallbackConfig;
    return fallbackConfig;
  }
}

/**
 * Get the default server from the configuration
 * @returns Promise<ServerConfig>
 */
export async function getDefaultServer(): Promise<ServerConfig> {
  const config = await loadConfig();
  
  if (!config.servers || config.servers.length === 0) {
    throw new Error('No servers configured');
  }
  
  return convertToServerConfig(config.servers[0]);
}

/**
 * Get all servers from the configuration
 * @returns Promise<ServerConfig[]>
 */
export async function getAllServers(): Promise<ServerConfig[]> {
  const config = await loadConfig();
  return config.servers.map(convertToServerConfig);
}