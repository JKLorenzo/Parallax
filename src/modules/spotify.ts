import SpotifyWebApi from 'spotify-web-api-node';

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

export async function getPlaylist(url: string): Promise<SpotifyApi.SinglePlaylistResponse> {
  const playlistId = url.split('playlist/')[1].split('?si=')[0];
  const playlist = await spotify.getPlaylist(playlistId);
  return playlist.body;
}

export async function getTrack(url: string): Promise<SpotifyApi.SingleTrackResponse> {
  const trackId = url.split('track/')[1].split('?si=')[0];
  const track = await spotify.getTrack(trackId);
  return track.body;
}
