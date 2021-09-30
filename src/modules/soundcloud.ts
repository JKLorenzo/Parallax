import { Client, Playlist, Song } from 'soundcloud-scraper';
const soundcloud = new Client();

function removeQueries(url: string): string {
  return url.split('?')[0];
}

export async function getSoundCloudTrack(url: string): Promise<Song | undefined> {
  const song = await soundcloud.getSongInfo(removeQueries(url));
  if (song) return song;
}

export async function getSoundCloudPlaylist(url: string): Promise<Playlist | undefined> {
  const playlist = await soundcloud.getPlaylist(removeQueries(url));
  if (playlist) return playlist;
}
