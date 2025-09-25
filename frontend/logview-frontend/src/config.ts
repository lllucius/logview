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
 * Load the frontend configuration (now injected at build time via Vite SSR)
 * @returns Promise<FrontendConfig>
 */
export async function loadConfig(): Promise<FrontendConfig> {
  if (configCache) {
    return configCache;
  }

  try {
    // Use the configuration injected at build time by Vite
    configCache = __FRONTEND_CONFIG__;
    return configCache;
  } catch (error) {
    console.error('Failed to load injected config, using defaults:', error);
    
    // Fallback to hardcoded config if injection fails
    const fallbackConfig: FrontendConfig = {
      servers: [
        {
          id: 'default',
          name: 'Local Server',
          host: 'localhost',
          port: 10000
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

/**
 * Get the frontend configuration (host and port for serving)
 * @returns Promise<{host: string, port: number}>
 */
export async function getFrontendConfig(): Promise<{host: string, port: number}> {
  const config = await loadConfig();
  
  // Return configured frontend settings or defaults
  return config.frontend || {
    host: 'localhost',
    port: 10001
  };
}
