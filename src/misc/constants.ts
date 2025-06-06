export abstract class Constants {
  static readonly CONTROL_SERVER_ID = '806481618008539137';
  static readonly QUARANTINE_GAMING_ID = '351178660725915649';

  static readonly DEDICATED_CHANNEL_CATEGORY_ID = '778541774154891264';

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
}

enum Containers {
  GAME_INVITE = 1 << 10,
  AUTOMOD = 2 << 10,
}

export enum GameInviteComponents {
  GAME_INVITE_CONTAINER = Containers.GAME_INVITE,
  GAME_NAME_TEXT,
  APP_ID_TEXT,
  HEADER_SECTION,
  INVITER_TEXT,
  JOINER_TEXT_RANGE_START, // SHOULD ALWAYS BE LAST
}

export enum AutoModComponents {
  AUTOMOD_CONTAINER = Containers.AUTOMOD,
  AUTOMOD_OFFENDER,
  AUTOMOD_EVIDENCE,
}
