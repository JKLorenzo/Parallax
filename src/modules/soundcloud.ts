import { Client, Playlist, SearchResult, Song } from 'soundcloud-scraper';

const soundcloud = new Client();

const _trackCache = new Map<string, Song>();
const _playlistCache = new Map<string, Playlist>();
const _searchCache = new Map<string, SearchResult>();

function removeQueries(url: string): string {
  return url.split('?')[0];
}

export async function getSoundCloudTrack(url: string): Promise<Song | undefined> {
  const id = removeQueries(url).trim();

  const cached = _trackCache.get(id);
  if (cached) return cached;

  const song = await soundcloud.getSongInfo(id);
  if (song) _trackCache.set(id, song);

  return song;
}

export async function getSoundCloudPlaylist(url: string): Promise<Playlist | undefined> {
  const id = removeQueries(url).trim();

  const cached = _playlistCache.get(id);
  if (cached) return cached;

  const playlist = await soundcloud.getPlaylist(id);
  if (playlist) _playlistCache.set(id, playlist);

  return playlist;
}

export async function searchSoundCloud(term: string): Promise<SearchResult | undefined> {
  const id = term.toLowerCase().trim();

  const cached = _searchCache.get(id);
  if (cached) return cached;

  const data = await soundcloud.search(term, 'track');

  const result = data[0];
  if (result) _searchCache.set(id, result);

  return result;
}
