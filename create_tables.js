const config = require("./config.json");
const pg = require("pg");
const postgres = new pg.Client(config.postgres);

const query = [
    "CREATE TABLE users (",
    "id bigint,",
    "dotaid bigint,",
    "points json,",
    "PRIMARY KEY (dotaid)",
    ");"
];

postgres.connect((err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    postgres.query(query.join(" ")).then((res) => {
        console.log(res);
        process.exit(0);
    }).catch((err) => {
        console.error(err);
        process.exit(1);
    });
});
