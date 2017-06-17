const config = require("./config.json");
const events = require("./events.json");
const emojis = require("./emojis.json");

const Postgres = require("pg");
const Eris = require("eris");
const Bridge = require("./Bridge");
const schedule = require("node-schedule");

let printDebug = false;
const postgres = new Postgres.Client(config.postgres);
const client = new Eris(config.discord.token, {
    getAllUsers: true
});
var bridge = new Bridge(config.dota2, printDebug);
const tasks = {};

client.ready = false;
bridge.ready = false;

function getBadge(eventID, eventPoints) {
    if (!events[eventID]) return false;
    let levels = events[eventID].levels;
    for (let level in levels) {
        if (eventPoints > levels[level]) return 5 - level; // javascript
    }

    return false;
}

bridge.on("debug", (debug, obj) => {
    if (!printDebug) return;
    console.log(debug);
    if (obj && typeof obj == "object") console.log(JSON.stringify(obj, null, 4));
    if (obj && typeof obj != "object") console.log(obj);
});

bridge.on("unhandled", (kMsg) => {
    console.log(kMsg);
});

async function updateDB(dotaid, eventID, eventPoints) {
    try {
        let resUser = await postgres.query({
            text: "SELECT * FROM users WHERE dotaid = $1;",
            values: [dotaid]
        });

        if (resUser.rows.length) {
            let user = resUser.rows[0];
            if (!user.points) user.points = {};
            user.points[eventID] = eventPoints;

            await postgres.query({
                text: "UPDATE users SET points = $1 WHERE dotaid = $2;",
                values: [user.points, dotaid]
            });

            return;
        } else {
            let points = {};
            points[eventID] = eventPoints;

            await postgres.query({
                text: "INSERT INTO users (dotaid, points) VALUES ($1, $2);",
                values: [dotaid, points]
            });

            return;
        }
    } catch (err) {
        console.error(err);
        return;
    }
}

bridge.on("message", (msg) => {
    if (msg.content) {
        let author = msg.author.name.slice();
        if (msg.author.streak) author = `${emojis.victory} ${author}`;
        if (msg.author.eventPoints) {
            let level = getBadge(msg.author.eventID, msg.author.eventPoints);
            if (level) author = `${emojis[level]} ${author}`;
        }

        client.createMessage(config.discord.channelID, `**${author}:** ${msg.content}`);
    } else {
        msg.content = false;
        if (msg.diceRoll) msg.content = `**${msg.author.name}** rolled a die (${msg.diceRoll.roll_min} - ${msg.diceRoll.roll_max}): **${msg.diceRoll.result}**`;
        if (msg.coinFlip) msg.content = `**${msg.author.name}** flipped a coin: **${msg.coinFlip.toUpperCase()}**`;

        if (msg.content) client.createMessage(config.discord.channelID, msg.content);
    }

    if (!msg.author) return;
    if (!(msg.author.id && msg.author.eventID && msg.author.eventPoints)) return;

    return updateDB(msg.author.id.toString(), msg.author.eventID.toString(), msg.author.eventPoints);
});

const commands = {
    link: async function(ctx) {
        if (!ctx.options[1]) {
            return "You haven't told me an ID!";
        }

        if (isNaN(ctx.options[1])) {
            return "Please tell me a number!";
        }

        try {
            let res = await postgres.query({
                text: "UPDATE users SET id = $1 WHERE dotaid = $2;",
                values: [ctx.message.author.id, ctx.options[1]]
            });

            if (res.rowCount == 1) {
                editMessage();
                return "OK :)";
            }

            await postgres.query({
                text: "INSERT INTO users (id, dotaid) VALUES ($1, $2);",
                values: [ctx.message.author.id, ctx.options[1]]
            });

            editMessage();
            return "OK :)";
        } catch (err) {
            console.error(err);
            return "Something went wrong, and the error has been logged. Sorry about that!";
        }
    }
};

client.on("messageCreate", (message) => {
    if (!message.author) return;
    if (!bridge.ready) return;
    if (!message.content) return;
    if (message.channel.guild.id !== config.discord.guildID) return;
    if (message.channel.id !== config.discord.channelID) return;
    if (message.author.id === client.user.id) return;

    bridge.sendMessage(config.dota2.channelName, `${message.author.username}: ${message.cleanContent}`);

    if (message.content.startsWith(config.discord.prefix)) {
        message.content = message.content.replace(config.discord.prefix, "");

        let ctx = {
            message: message,
            options: message.content.split(" ")
        };

        if (ctx.options[0] in commands) {
            commands[ctx.options[0]](ctx).then((response) => {
                if (typeof response === "string") {
                    bridge.sendMessage(config.dota2.channelName, `[BOT] ${response}`);
                    client.createMessage(config.discord.channelID, `**[BOT]** ${response}`);
                } else {
                    if (response.dota) bridge.sendMessage(config.dota2.channelName, `[BOT] ${response.dota}`);
                    if (response.discord) client.createMessage(config.discord.channelID, `**[BOT]** ${response.discord}`);
                }
            }).catch((err) => {
                console.error(err);
            });
        }
    }
});

function editMessage() {
    postgres.query("SELECT * FROM users;").catch((err) => console.error(err)).then((res) => {
        let eventsList = Object.keys(events);
        let latestEvent = eventsList[eventsList.length - 1];

        let rows = res.rows
            .filter((row) => row.points && row.points[latestEvent])
            .sort((a, b) => b.points[latestEvent] - a.points[latestEvent])
            .map((row, index) => {
                let badge = getBadge(latestEvent, row.points[latestEvent]);
                let score = Math.floor(row.points[latestEvent] / 1000) - 2;
                let username = client.users.get(row.id) ? client.users.get(row.id).username : "`Unknown User`";

                return `\`${index + 1}.\`${emojis[badge.toString()]}**${score}**: ${username}`;
            });

        rows.slice(0, 25);
        rows.unshift("**CLUB PURPLE BATTLE PASS LEADERBOARD**", `Stats from event \`${events[latestEvent].name}\``, "");

        client.editMessage(config.discord.editChannel, config.discord.editMessage, rows.join("\n"));
    });
}

bridge.on("ready", () => {
    console.log("bridge ready.");
    bridge.ready = true;

    editMessage();
    tasks.edit = schedule.scheduleJob("0 */1 * * *", editMessage);
});

client.on("ready", () => {
    console.log("discord ready.");
    client.ready = true;
    bridge.connect();
});


postgres.connect((err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    console.log("postgres ready.");
    client.connect();
});
