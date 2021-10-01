import youtubeSearch, { YouTubeSearchResults } from 'youtube-search';
import ytdl_core from 'ytdl-core';
const { getInfo } = ytdl_core;

const _infoCache = new Map<string, ytdl_core.videoInfo>();
const _searchCache = new Map<string, YouTubeSearchResults>();

export async function getYouTubeInfo(url: string): Promise<ytdl_core.videoInfo | undefined> {
  const id = url.trim();

  const cached = _infoCache.get(id);
  if (cached) return cached;

  const data = await getInfo(id);
  if (data) _infoCache.set(id, data);

  return data;
}

export async function searchYouTube(term: string): Promise<YouTubeSearchResults | undefined> {
  const id = term.toLowerCase().trim();

  const cached = _searchCache.get(id);
  if (cached) return cached;

  const data = await youtubeSearch(id, {
    key: process.env.GOOGLE_KEY,
    maxResults: 1,
  });

  const result = data.results[0];
  if (result) _searchCache.set(id, result);

  return result;
}
