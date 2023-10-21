export default class Constants {
  static readonly CONTROL_SERVER_ID = '806481618008539137';

  static readonly MUSIC_DISABLED =
    'Music commands are temporarily disabled. Please try again later.';
  static readonly MUSIC_JOIN_CHANNEL_FAILED = 'Failed to join your current voice channel.';
  static readonly MUSIC_QUERY_EMPTY =
    'Search query is empty. Please try again by entering the link or the title of a song.';
  static readonly MUSIC_QUERY_NO_RESULT = 'No match found for this query.';
  static readonly MUSIC_SKIPCOUNT_INVALID =
    'Invalid skip count. Please try again by enter a number not less than or equal to 0.';
  static readonly MUSIC_CONTROLS_DENY =
    "You must be on the same channel where I'm currently active to perform this action.";
  static readonly MUSIC_NOT_ACTIVE = "I'm currently not playing any music on this server.";
  static readonly MUSIC_PLAYER_IDLE = 'Nothing is currently being played.';
  static readonly MUSIC_PLAYER_PAUSE_FAILED =
    'Failed to pause the music player. It is likely already paused.';
  static readonly MUSIC_PLAYER_RESUME_FAILED =
    'Failed to resume the music player. It is likely already playing.';
  static readonly MUSIC_PLAYER_PAUSEPLAY_FAILED = 'Failed to pause or play the music player.';
  static readonly MUSIC_BOT_MSG_NOT_SUPPORTED = 'Messages sent by bots are not supported.';
  static readonly MUSIC_MSG_NOT_SUPPORTED = 'This message is not supported.';

  static readonly VOICE_CHANNEL_FULL =
    'Your current voice channel has a user limit and is already full.';
  static readonly VOICE_CHANNEL_JOIN = 'Join a voice channel and then try that again.';
  static readonly VOICE_CHANNEL_DIFF = "I'm currently playing on another channel.";

  static readonly NO_PERM_VAD =
    'I need to have the `Use Voice Activity` permission to use this command.';
  static readonly NO_PERM_SPEAK = 'I need to have the `Speak` permission to use this command.';
  static readonly NO_PERM_CONNECT =
    'I need to have the `Connect` permission to join your current voice channel.';
  static readonly NO_PERM_VIEW_CHANNEL =
    'I need to have the `View Channel` permission to join your current voice channel.';

  static readonly PLAYDL_429_ERROR_PATTERN = 'Got 429 from the request';
}
