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
  INVITE_ID,
}

export enum AutoModComponents {
  AUTOMOD_CONTAINER = Containers.AUTOMOD,
  AUTOMOD_OFFENDER,
  AUTOMOD_EVIDENCE,
}
