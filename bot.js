const config = require("./config.json");

const Eris = require("eris");
const client = new Eris(config.discord.token, config.discord.options);

const Bridge = require("./Bridge");
var bridge = new Bridge(config.dota2, true);

bridge.on("debug", (debug, obj) => {
    console.log(debug);
    if (obj && typeof obj == "object") console.log(JSON.stringify(obj, null, 4));
    if (obj && typeof obj != "object") console.log(obj);
});

bridge.on("message", (msg) => {
    if (msg.content) {
        let disp = `**${msg.author.name}:** ${msg.content}`;
        if (msg.diceRoll) disp = `**${msg.author.name} rolled a die (${msg.diceRoll.roll_min} - ${msg.diceRoll.roll_max}): **${msg.diceRoll.result}**`;
        if (msg.coinFlip) disp = `**${msg.author.name}** flipped a coin: **${msg.coinFlip.toUpperCase()}**`;

        client.createMessage(config.discord.channelID, disp);
    }
});

bridge.on("ready", () => {
    console.log("bridge ready.");
});

client.on("ready", () => {
    console.log("discord ready.");
    client.editNickname(config.discord.guildID, "~~");
    bridge.connect();
});

client.connect();
