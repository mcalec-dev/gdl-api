export const url = window.location.origin;
export const host = window.location.hostname;
export const path = window.location.pathname;
export const query = window.location.search;
export function formatSize(bytes) {
  const units =   ['b', 'Kb', 'Mb', 'Gb', 'Tb'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  const formattedSize = `${Math.round(size * 100 / 100)} ${units[unitIndex]}`;
  return formattedSize;
}
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const options = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'America/New_York',
    hour12: true,
  };
  return date.toLocaleString('en-US', options);
}
export async function apiHost() {
  const endpoints = [
    'https://alt-api.mcalec.dev/gdl/api',
    'https://api.mcalec.dev/gdl/api'
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { 
        method: 'GET'
      });
      if (response.ok) {
        return endpoint;
      }
    } catch (error) {
      console.error(`Failed to connect to ${endpoint}:`, error);
    }
  }
  throw new Error('No API endpoints are available');
}