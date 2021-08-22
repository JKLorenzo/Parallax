import youtubeSearch, { YouTubeSearchOptions, YouTubeSearchResults } from 'youtube-search';

const options: YouTubeSearchOptions = {
  key: process.env.GOOGLE_API,
  maxResults: 1,
};

export async function searchYouTube(term: string): Promise<YouTubeSearchResults | undefined> {
  try {
    const data = await youtubeSearch(term, options);
    if (data.results.length) return data.results[0];
  } catch (error) {
    console.error(error);
  }
}
