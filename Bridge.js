const EventEmitter = require("events").EventEmitter;
const fs = require("fs");
const crypto = require("crypto");

const Steam = require("steam");
const Dota2 = require("dota2");

class Bridge extends EventEmitter {
    constructor(options) {
        super();

        this.username = options.username;
        this.password = options.password;
        this.channelName = options.channelName;
        this.channelType = options.channelType;

        try {
            this.sentry = fs.readFileSync("sentry");
        } catch (err) {
            fs.closeSync(fs.openSync("sentry", "w"));
            this.sentry = null;
        }

        this.steamClient = new Steam.SteamClient();
        this.steamUser = new Steam.SteamUser(this.steamClient);
        this.steamFriends = new Steam.SteamFriends(this.steamClient);
        this.dota2 = new Dota2.Dota2Client(this.steamClient, true, true); // todo remove second true

        this.steamClient.on("connected", () => this._onSteamConnected.call(this));

        this.steamClient.on("logOnResponse", (logonResp) => this._onSteamLogOn.call(this, logonResp));
        this.steamClient.on("loggedOff", (eresult) => this.emit("error", "logged off from steam."));
        this.steamClient.on("error", (err) => this.emit("error", err, "steam"));

        this.steamUser.on("updateMachineAuth", (sentry, callback) => this._updateMachineAuth.call(this, sentry, callback));

        this.dota2.on("ready", () => this._dota2Ready.call(this));
        this.dota2.on("chatJoined", (channelData) => this._dota2ChatJoined.call(this, channelData));
        this.dota2.on("chatMessage", (channel, personaName, message, chatObject) => this.emitMessage.call(this, channel, personaName, message, chatObject));
        this.dota2.on("unhandled", (kMsg) => this._unhandled.call(this, kMsg));
        this.dota2.on("hellotimeout", () => { this.emit("error", "dota2", "hellotimeout") });
    }

    _onSteamConnected() {
        this.emit("debug", "steam connected. logging on...");
        this.steamUser.logOn({
            "account_name": this.username,
            "password": this.password,
            "sha_sentryfile": this.sentry
        });
    }

    _onSteamLogOn(logonResp) {
        this.emit("debug", "recieved steam log on response", logonResp);
        if (logonResp.eresult == Steam.EResult.OK) {
            this.steamFriends.setPersonaState(Steam.EPersonaState.Busy);
            this.steamFriends.setPersonaName(this.personaname);
            this.dota2.launch();
        }
    }

    _updateMachineAuth(sentry, callback) {
        let hashedSentry = crypto.createHash("sha1").update(sentry.bytes).digest();
        fs.writeFile("sentry", hashedSentry, (err) => {
            if (err) this.emit("error", "steam", err);
            if (!err) {
                this.emit("debug", "new sentry file saved.");
                callback({
                    "sha_file": hashedSentry
                });
            }
        });
    }

    _dota2Ready() {
        this.emit("debug", "dota 2 ready. joining chat...");
        this.dota2.joinChat(this.channelName, this.channelType);
    }

    _dota2ChatJoined(channelData) {
        this.emit("ready");
        this.emit("debug", "dota 2 ready");
    }

    _unhandled(kMsg) {
        this.emit("unhandled", kMsg);
        this.emit("debug", "unhandled message", kMsg);
    }

    sendMessage(channel, message) {
        this.emit("debug", `sending message to ${channel}`, message);
        this.dota2.sendMessage(channel, message);
    }

    emitMessage(channel, personaName, message, chatObject) {
        this.emit("debug", "recieved chat object", chatObject);

        let msg = {};

        if (chatObject.hasOwnProperty("persona_name") && chatObject.hasOwnProperty("account_id"))  {
            msg.author = {
                "name": chatObject.persona_name,
                "id": chatObject.account_id
            }

            if (chatObject.hasOwnProperty("event_id") && chatObject.hasOwnProperty("event_points")) {
                msg.author.eventID = chatObject.event_id;
                msg.author.eventPoints = chatObject.event_points;
            }

            if (chatObject.hasOwnProperty("battle_cup_streak")) msg.author.streak = chatObject.battle_cup_streak;
            if (chatObject.hasOwnProperty("badge_level")) msg.author.level = chatObject.badge_level;
        }

        if (chatObject.hasOwnProperty("channel_id")) msg.channelID = chatObject.channel_id;
        if (chatObject.hasOwnProperty("dice_roll")) message.diceRoll = JSON.parse(JSON.stringify(chatObject.dice_roll));
        if (chatObject.hasOwnProperty("coin_flip")) message.coinFlip = chatObject.coinFlip ? "heads" : "tails";
        if (chatObject.hasOwnProperty("text")) msg.content = chatObject.text;

        if (msg !== {}) this.emit("message", msg);
    }

    connect() {
        this.emit("debug", "connecting to steam...");
        this.steamClient.connect();
    }
}

module.exports = Bridge;
