import { CreateRoleOptions, Guild, GuildMember, Role } from 'discord.js';
import { getBotConfig } from './database.js';
import { queuerOf } from '../utils/queuer.js';

export function createRole(guild: Guild, data: CreateRoleOptions): Promise<Role | undefined> {
  return queuerOf(guild.id).queue(async () => {
    const maxRoles = await getBotConfig('GuildMaxRoles');
    if (!maxRoles || guild.roles.cache.size >= parseInt(maxRoles)) return;
    const role = await guild.roles.create(data);
    return role;
  });
}

export function deleteRole(role: Role): Promise<void> {
  return queuerOf(role.guild.id).queue(async () => {
    await role.delete();
  });
}

export function addRole(member: GuildMember, role: Role | Role[]): Promise<void> {
  return queuerOf(member.guild.id).queue(async () => {
    await member.roles.add(role);
  });
}

export function removeRole(member: GuildMember, role: Role | Role[]): Promise<void> {
  return queuerOf(member.guild.id).queue(async () => {
    await member.roles.remove(role);
  });
}
