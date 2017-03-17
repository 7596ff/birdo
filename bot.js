const config = require("./config.json");

const Bridge = require("./Bridge");
var bridge = new Bridge(config.dota2);

bridge.on("debug", (debug, obj) => {
    console.log(debug);
    if (obj && typeof obj == "object") console.log(JSON.stringify(obj, null, 4));
    if (obj && typeof obj != "object") console.log(obj);
});

bridge.on("ready", () => {
    console.log("bridge ready.");
});

bridge.connect();
