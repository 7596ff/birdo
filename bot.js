const config = reqiure("./config.json");

const Bridge = require("./Bridge");
var bridge = new Bridge(config.dota2);

bridge.on("debug", (debug) => {
    console.log(debug);
});

bridge.on("ready", () => {
    console.log("bridge ready.");
});

bridge.connect();
