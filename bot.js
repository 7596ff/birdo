const config = require("./config.json");
const events = require("./events.json");
const emojis = require("./emojis.json");

const Eris = require("eris");
const Bridge = require("./Bridge");

let printDebug = false;
const client = new Eris(config.discord.token);
var bridge = new Bridge(config.dota2, printDebug);

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
});

client.on("messageCreate", (message) => {
    if (!message.author) return;
    if (!bridge.ready) return;
    if (!message.content) return;
    if (message.channel.guild.id !== config.discord.guildID) return;
    if (message.channel.id !== config.discord.channelID) return;
    if (message.author.id === client.user.id) return;

    bridge.sendMessage(config.dota2.channelName, `${message.author.username}: ${message.cleanContent}`);
});

bridge.on("ready", () => {
    console.log("bridge ready.");
    bridge.ready = true;
});

client.on("ready", () => {
    console.log("discord ready.");
    client.ready = true;
    bridge.connect();
});

client.connect();
