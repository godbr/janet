const mongo = require('../mongo')
const Discord = require('discord.js')
const { prefix: globalPrefix } = require('../config.json')
const guildPrefixes = {}

// Per server config
const commandPrefixSchema = require('../schemas/command.prefix-schema')
const leveling = require('../server/level')

const validatePermissions = (permissions) => {
  const validPermissions = [
    'CREATE_INSTANT_INVITE',
    'KICK_MEMBERS',
    'BAN_MEMBERS',
    'ADMINISTRATOR',
    'MANAGE_CHANNELS',
    'MANAGE_GUILD',
    'ADD_REACTIONS',
    'VIEW_AUDIT_LOG',
    'PRIORITY_SPEAKER',
    'STREAM',
    'VIEW_CHANNEL',
    'SEND_MESSAGES',
    'SEND_TTS_MESSAGES',
    'MANAGE_MESSAGES',
    'EMBED_LINKS',
    'ATTACH_FILES',
    'READ_MESSAGE_HISTORY',
    'MENTION_EVERYONE',
    'USE_EXTERNAL_EMOJIS',
    'VIEW_GUILD_INSIGHTS',
    'CONNECT',
    'SPEAK',
    'MUTE_MEMBERS',
    'DEAFEN_MEMBERS',
    'MOVE_MEMBERS',
    'USE_VAD',
    'CHANGE_NICKNAME',
    'MANAGE_NICKNAMES',
    'MANAGE_ROLES',
    'MANAGE_WEBHOOKS',
    'MANAGE_EMOJIS',
  ]

  for (const permission of permissions) {
    if (!validPermissions.includes(permission)) {
      throw new Error(`Permissão Desconhecida: "${permission}"`)
    }
  }
}

const allCommands = []

module.exports = (commandOptions) => {
  let {
    commands,
    permissions = [],
  } = commandOptions

  // Ensure the command and aliases are in an array
  if (typeof commands === 'string') {
    commands = [commands]
  }

  // Ensure the permissions are in an array and are all valid
  if (permissions.length) {
    if (typeof permissions === 'string') {
      permissions = [permissions]
    }

    validatePermissions(permissions)
  }

  for (const command of commands) {
    allCommands[command] = {
      ...commandOptions,
      commands,
      permissions
    };
  }
}

module.exports.listen = (client) => {

  // Per server Functions
  leveling(client)

  // Listen for messages
  client.on('message', (message) => {

    const { member, content, guild } = message;
    const prefix = guildPrefixes[guild.id] || globalPrefix
    
    // Split on any number of spaces
    const arguments = content.split(/[ ]+/)

    // Remove the command which is the first index
    const name = arguments.shift().toLowerCase();

    if(name.startsWith(prefix)) {
      const command = allCommands[name.replace(prefix, '')]
      if (!command) {
        return
      }

      const {
        permissions,
        permissionError = "Você não tem permissão para rodar esse comando.",
        requiredRoles = [],
        minArgs = 0,
        maxArgs = null,
        expectedArgs,
        callback,
      } = command;

      // Ensure the user has the required permissions
      for (const permission of permissions) {
        if (!member.hasPermission(permission)) {
          message.reply(permissionError)
          return
        }
      }

      // Ensure the user has the required roles
      for (const requiredRole of requiredRoles) {
        const role = guild.roles.cache.find(
          (role) => role.name === requiredRole
        )

        if (!role || !member.roles.cache.has(role.id)) {
          message.reply(
            `Você precisa ter a permissão "${requiredRole}" para usar esse comando.`
          )
          return
        }
      }

      // Ensure we have the correct number of arguments
      if (
        arguments.length < minArgs ||
        (maxArgs !== null && arguments.length > maxArgs)
      ) {

        // Set Embed response
        embed = new Discord.MessageEmbed()
        .setTitle(`Comando inválido`)
        .setDescription(`Use ${prefix}${name.replace(prefix, '')} ${expectedArgs}`)
        .setAuthor(`${client.user.username}`, client.user.avatarURL())
        .setColor('RANDOM')
        .setTimestamp()

        message.channel.send(embed)
        return;
      }

      // Handle the custom command code
      callback(message, arguments, arguments.join(' '), client, prefix);
    }
  })
}

module.exports.updateCache = (guildId, newPrefix) => {
  guildPrefixes[guildId] = newPrefix
}

module.exports.loadPrefixes = async (client) => {
  await mongo().then(async mongoose => {
    try {
      for (const guild of client.guilds.cache) {
        const guildId = guild[1].id
        const result = await commandPrefixSchema.findOne({ _id: guildId })
        if(result) {
          guildPrefixes[guildId] = result.prefix
        }        
      }
    }finally {
      mongoose.connection.close()
    }
  })
  
}