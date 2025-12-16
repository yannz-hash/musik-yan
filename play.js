const { EmbedBuilder } = require('discord.js');
const MusicPlayer = require('../../utils/musicPlayer');

module.exports = {
    name: 'play',
    aliases: ['p', 'musik'],
    description: 'Play music from YouTube',
    usage: '<song name/URL>',
    
    async execute(message, args, client) {
        if (!args.length) {
            return message.reply('Please provide a song name or URL!');
        }
        
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('You need to be in a voice channel to play music!');
        }
        
        const query = args.join(' ');
        
        if (!client.queues.has(message.guild.id)) {
            client.queues.set(message.guild.id, new MusicPlayer(message.guild.id));
        }
        
        const queue = client.queues.get(message.guild.id);
        
        // Add to queue
        const result = await queue.addToQueue(message, query);
        
        if (!result.success) {
            return message.reply(result.message);
        }
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('✅ Added to Queue')
            .setDescription(`**${result.track.title}**`)
            .addFields(
                { name: 'Duration', value: result.track.duration, inline: true },
                { name: 'Position in queue', value: `#${result.position}`, inline: true },
                { name: 'Requested by', value: result.track.requester, inline: true }
            )
            .setThumbnail(result.track.thumbnail)
            .setTimestamp();
        
        message.channel.send({ embeds: [embed] });
        
        // Play if not already playing
        if (!queue.isPlaying) {
            await queue.play(message);
        }
    }
};
