import { Client, Playlist, SearchResult, Song } from 'soundcloud-scraper';
import { getStringSimilarity, parseHTML } from '../utils/functions.js';

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
  const id = term.toLowerCase().replaceAll('soundcloud', '').trim();

  const cached = _searchCache.get(id);
  if (cached) return cached;

  const results = await soundcloud.search(id, 'track');

  let data: {
    similarity: number;
    result?: SearchResult;
  } = { similarity: -1 };

  for (const result of results) {
    const title = parseHTML(result.name).trim();
    const author = parseHTML(result.artist).trim();

    const similarity = getStringSimilarity(id, `${title} ${author}`.trim().toLowerCase());
    if (similarity > data.similarity) data = { similarity, result };
  }

  const result = data.result;
  if (result) _searchCache.set(id, result);

  return result;
}
