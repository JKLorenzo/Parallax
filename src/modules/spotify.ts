import SpotifyWebApi from 'spotify-web-api-node';

const _searchCache = new Map<string, SpotifyApi.SearchResponse>();
const _trackCache = new Map<string, SpotifyApi.SingleTrackResponse>();
const _playlistCache = new Map<string, SpotifyApi.SinglePlaylistResponse>();
const _albumCache = new Map<string, SpotifyApi.SingleAlbumResponse>();

const spotify = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_ID,
  clientSecret: process.env.SPOTIFY_SECRET,
});

export async function initSpotify(): Promise<void> {
  try {
    const data = await spotify.clientCredentialsGrant();
    spotify.setAccessToken(data.body.access_token);
    setTimeout(initSpotify, data.body.expires_in * 1000);
  } catch (error) {
    console.error(error);
    setTimeout(initSpotify, 5000);
  }
}

export async function searchSpotify(query: string): Promise<SpotifyApi.SearchResponse> {
  const searchQuery = query.toLowerCase().replaceAll('  ', ' ').trim();

  const cached = _searchCache.get(searchQuery);
  if (cached) return cached;

  const track = await spotify.search(query, ['track'], { limit: 1 });

  const data = track.body;
  if (data) _searchCache.set(searchQuery, data);

  return data;
}

export async function getSpotifyTrack(
  url: string,
): Promise<SpotifyApi.SingleTrackResponse | undefined> {
  const trackId = url.split('track/')[1].split('?si=')[0].trim();

  const cached = _trackCache.get(trackId);
  if (cached) return cached;

  const track = await spotify.getTrack(trackId);

  const data = track.body;
  if (data) _trackCache.set(trackId, data);

  return data;
}

export async function getSpotifyPlaylist(
  url: string,
): Promise<SpotifyApi.SinglePlaylistResponse | undefined> {
  const playlistId = url.split('playlist/')[1].split('?si=')[0].trim();

  const cached = _playlistCache.get(playlistId);
  if (cached) return cached;

  const playlist = await spotify.getPlaylist(playlistId);

  const data = playlist.body;
  if (data) _playlistCache.set(playlistId, data);

  return data;
}

export async function getSpotifyAlbum(
  url: string,
): Promise<SpotifyApi.SingleAlbumResponse | undefined> {
  const albumId = url.split('album/')[1].split('?si=')[0].trim();

  const cached = _albumCache.get(albumId);
  if (cached) return cached;

  const album = await spotify.getAlbum(albumId);

  const data = album.body;
  if (data) _albumCache.set(albumId, data);

  return data;
}
