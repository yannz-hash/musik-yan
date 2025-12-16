module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ ${client.user.tag} is online!`);
        
        // Set Activity
        client.user.setActivity({
            name: `${process.env.PREFIX}help | Music Bot`,
            type: ActivityType.Listening
        });
        
        // Update status every 30 minutes
        setInterval(() => {
            const activities = [
                { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching },
                { name: `${process.env.PREFIX}play songs`, type: ActivityType.Listening },
                { name: 'Music commands', type: ActivityType.Playing }
            ];
            const randomActivity = activities[Math.floor(Math.random() * activities.length)];
            client.user.setActivity(randomActivity);
        }, 1800000);
    }
};
