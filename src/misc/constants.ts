export abstract class Constants {
  static readonly GAME_MANAGER_TITLE = 'Parallax: Game Manager';
  static readonly GAME_EMBED_APPID_FIELD = 'Application Id';
  static readonly GAME_EMBED_ROLE_FIELD = 'Role';
  static readonly GAME_EMBED_MOD_FIELD = 'Moderator';
  static readonly GAME_EMBED_STATUS_FIELD = 'Status';
  static readonly GAME_EMBED_ICON_FIELD = 'Icon';
  static readonly GAME_EMBED_BANNER_FIELD = 'Banner';
  static readonly GAME_EMBED_LASTPLAYED_FIELD = 'Last Played';
  static readonly GAME_EMBED_INVITER_FIELD = 'Inviter';
  static readonly GAME_INVITE_EXPIRATION_MINS = 60;

  static readonly AUTOMOD_MANAGER_TITLE = 'Parallax: AutoMod Manager';
  static readonly AUTOMOD_TIMEOUT_MINS = 5;

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
  static readonly MUSIC_CONTROLS_DENY =
    "You must be on the same channel where I'm currently active to perform this action.";
  static readonly MUSIC_NOT_ACTIVE = "I'm currently not playing any music on this server.";
  static readonly MUSIC_PLAYER_PAUSEPLAY_FAILED = 'Failed to pause or play the music player.';
  static readonly MUSIC_PLAYER_PAUSE_FAILED =
    'Failed to pause the music player. It is likely already paused.';
  static readonly MUSIC_PLAYER_RESUME_FAILED =
    'Failed to resume the music player. It is likely already playing.';
  static readonly MUSIC_SKIPCOUNT_INVALID =
    'Invalid skip count. Please try again by enter a number not less than or equal to 0.';
  static readonly MUSIC_PLAYER_IDLE = 'Nothing is currently being played.';
  static readonly MUSIC_QUERY_NO_RESULT = 'No match found for this query.';
}

export abstract class CSConstants {
  static readonly GUILD_ID = '806481618008539137';

  static readonly PROCESSES_CHANNEL_CATEGORY_ID = '1385521799667646626';

  static readonly GENERAL_TEXT_CHANNEL_ID = '806481618465194015';
  static readonly GAME_SCREENING_CHANNEL_ID = '1354416171717361848';
}

export abstract class QGConstants {
  static readonly GUILD_ID = '351178660725915649';

  static readonly DEDICATED_CHANNEL_CATEGORY_ID = '778541774154891264';

  static readonly GENERAL_TEXT_CHANNEL_ID = '749661539908190258';
}

enum Containers {
  GAME_INVITE = 1 << 10,
  AUTOMOD = 2 << 10,
}

export enum GameInviteComponents {
  GAME_INVITE_CONTAINER = Containers.GAME_INVITE,
  HEADER_SECTION,
  HEADER_TEXT,
}

export enum AutoModComponents {
  AUTOMOD_CONTAINER = Containers.AUTOMOD,
  AUTOMOD_OFFENDER,
  AUTOMOD_EVIDENCE,
}
