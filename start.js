const pm2 = require("pm2");
const async = require("async");

const guilds = require("./config.json").guilds;

pm2.connect((err) => {
    if (err) {
        console.error(err);
        process.exit(2);
    }

    async.each(guilds, (guild, cb) => {
        let app = {
            name: `birdo_${guild.discord.name}`,
            script: "./bot.js",
            instances: 1,
            args: [guild.discord.guildID],
            exec_mode: "fork"
        };

        console.log(`starting ${app.name}`);
        pm2.start(app, cb);
    }, (err) => {
        if (err) console.error(err);
        pm2.disconnect();
        process.exit(err ? 1 : 0);
    });
});
