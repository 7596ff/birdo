const EventEmitter = require("events");
const fs = require("fs");
const crypto = require("crypto");

const Steam = require("steam");
const Dota2 = require("dota2");

class Bridge extends EventEmitter {
    constructor(options) {
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

        this.steamClient = new steam.SteamClient();
        this.steamUser = new steam.SteamUser(this.steamClient);
        this.steamFriends = new steam.SteamFriends(this.steamClient);
        this.dota2 = new Dota2.Dota2Client(steamClient, true, true); // todo remove second true

        this.steamClient.on("connected", this._onSteamConnected);

        this.steamClient.on("logOnResponse", this._onSteamLogOn);
        this.steamClient.on("loggedOff", (eresult) => { this.emit("error", "logged off from steam.") });
        this.steamClient.on("error", (err) => { this.emit("error", "steam", err) });

        this.steamUser.on("updateMachineAuth", this._updateMachineAuth);

        this.dota2.on("ready", this._dota2Ready);
        this.dota2.on("chatJoined", this._dota2ChatJoined);
        this.dota2.on("unhandled", this._unhandled);
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
        if (logonResp.eresult == steam.EResult.OK) {
            this.steamFriends.setPersonaState(steam.EPersonaState.Busy);
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

    emitMessage(chatObject) {
        this.emit("debug", "recieved chat object", chatObject);
        this.emit("message", chatObject); // TRANSFORM THIS
    }

    connect() {
        this.emit("debug", "connecting to steam...");
        this.steamClient.connect();
    }
}

module.exports = Bridge;
