const { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const { EmbedBuilder } = require('discord.js');

class MusicPlayer {
    constructor(guildId) {
        this.guildId = guildId;
        this.queue = [];
        this.currentTrack = null;
        this.player = createAudioPlayer();
        this.connection = null;
        this.repeatMode = 'off'; // 'off', 'song', 'queue'
        this.volume = 100;
        this.isPlaying = false;
        this.voteSkips = new Set();
        
        this.player.on(AudioPlayerStatus.Idle, () => {
            this.handleTrackEnd();
        });
        
        this.player.on('error', error => {
            console.error('Player error:', error);
            this.handleTrackEnd();
        });
    }
    
    async addToQueue(message, query) {
        try {
            let track;
            
            // Check if it's a YouTube URL
            if (ytdl.validateURL(query)) {
                const info = await ytdl.getInfo(query);
                track = {
                    title: info.videoDetails.title,
                    url: info.videoDetails.video_url,
                    duration: this.formatDuration(info.videoDetails.lengthSeconds),
                    thumbnail: info.videoDetails.thumbnails[0].url,
                    requester: message.author.tag,
                    requesterId: message.author.id
                };
            } else {
                // Search YouTube
                const searchResult = await yts(query);
                if (!searchResult.videos.length) {
                    return { success: false, message: 'No results found!' };
                }
                
                const video = searchResult.videos[0];
                track = {
                    title: video.title,
                    url: video.url,
                    duration: video.duration.timestamp || 'N/A',
                    thumbnail: video.thumbnail,
                    requester: message.author.tag,
                    requesterId: message.author.id
                };
            }
            
            this.queue.push(track);
            return { success: true, track, position: this.queue.length };
            
        } catch (error) {
            console.error('Error adding to queue:', error);
            return { success: false, message: 'Error adding track to queue!' };
        }
    }
    
    async play(message) {
        if (!this.queue.length && !this.currentTrack) return;
        
        if (!this.currentTrack && this.queue.length) {
            this.currentTrack = this.queue.shift();
        }
        
        if (!this.connection) {
            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) return;
            
            this.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            
            this.connection.subscribe(this.player);
        }
        
        try {
            const stream = ytdl(this.currentTrack.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            });
            
            const resource = createAudioResource(stream, { inlineVolume: true });
            resource.volume.setVolume(this.volume / 100);
            
            this.player.play(resource);
            this.isPlaying = true;
            
            // Send now playing embed
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎵 Now Playing')
                .setDescription(`**${this.currentTrack.title}**`)
                .addFields(
                    { name: 'Duration', value: this.currentTrack.duration, inline: true },
                    { name: 'Requested by', value: this.currentTrack.requester, inline: true },
                    { name: 'Volume', value: `${this.volume}%`, inline: true }
                )
                .setThumbnail(this.currentTrack.thumbnail)
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Play error:', error);
            this.handleTrackEnd();
        }
    }
    
    handleTrackEnd() {
        if (this.repeatMode === 'song' && this.currentTrack) {
            // Repeat current song
            this.queue.unshift(this.currentTrack);
        } else if (this.repeatMode === 'queue' && this.currentTrack) {
            // Repeat queue
            this.queue.push(this.currentTrack);
        }
        
        this.currentTrack = null;
        this.voteSkips.clear();
        
        if (this.queue.length > 0) {
            this.currentTrack = this.queue.shift();
            // Auto-play next song
            if (this.connection && this.player) {
                this.playNext();
            }
        } else {
            this.isPlaying = false;
            // Disconnect after 5 minutes of inactivity
            setTimeout(() => {
                if (!this.isPlaying && this.connection) {
                    this.connection.destroy();
                    this.connection = null;
                }
            }, 300000);
        }
    }
    
    async playNext() {
        if (!this.currentTrack) return;
        
        try {
            const stream = ytdl(this.currentTrack.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            });
            
            const resource = createAudioResource(stream, { inlineVolume: true });
            resource.volume.setVolume(this.volume / 100);
            
            this.player.play(resource);
            this.isPlaying = true;
            
        } catch (error) {
            console.error('Play next error:', error);
            this.handleTrackEnd();
        }
    }
    
    skip(message) {
        if (!this.isPlaying) return false;
        
        this.player.stop();
        return true;
    }
    
    stop() {
        this.queue = [];
        this.currentTrack = null;
        this.player.stop();
        this.isPlaying = false;
        
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(100, volume));
        
        if (this.player.state.status === AudioPlayerStatus.Playing) {
            const resource = this.player.state.resource;
            if (resource.volume) {
                resource.volume.setVolume(this.volume / 100);
            }
        }
        
        return this.volume;
    }
    
    shuffle() {
        if (this.queue.length < 2) return false;
        
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
        
        return true;
    }
    
    formatDuration(seconds) {
        if (!seconds) return 'Live';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    getQueue() {
        return {
            current: this.currentTrack,
            queue: this.queue,
            repeatMode: this.repeatMode,
            volume: this.volume,
            isPlaying: this.isPlaying
        };
    }
}

module.exports = MusicPlayer;
