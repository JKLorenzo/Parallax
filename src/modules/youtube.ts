import youtubeSearch, { YouTubeSearchOptions, YouTubeSearchResults } from 'youtube-search';

const _cache = new Map<string, YouTubeSearchResults>();

const options: YouTubeSearchOptions = {
  key: process.env.GOOGLE_KEY,
  maxResults: 1,
};

export async function searchYouTube(term: string): Promise<YouTubeSearchResults | undefined> {
  try {
    if (!_cache.get(term)) {
      const data = await youtubeSearch(term, options);
      if (data.results.length) _cache.set(term, data.results[0]);
    }
    return _cache.get(term);
  } catch (error) {
    console.error(error);
  }
}
