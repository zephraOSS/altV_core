import * as alt from "alt-server";
import * as mysql from "mysql";
import * as log from "./log.mjs";

const memCons = {};

export function create(connections) {
    for (const [k, v] of Object.entries(connections)) {
        log.log(`SQL (${k}) successfully connected`, "CORE,SQL");

        if (memCons[k]) destroyConnection(k);

        memCons[k] = {};

        memCons[k].connection = mysql.createConnection(v);

        memCons[k].connection.connect(function (err) {
            if (err)
                return log.error(`SQL (${k}) connection error`, "CORE,SQL");
        });

        handleDisconnect(memCons[k].connection);

        alt.on(`sql:${k}:query`, function (query, callback) {
            if (!query) return;

            v.connection.query(query, function (err, results) {
                if (err) return log.error(`SQL (${k}) query error`, "CORE,SQL");

                if (callback) callback(results);
            });
        });

        alt.on(`sql:${k}:querySync`, function (query) {
            if (!query) return;

            return new Promise(function (resolve, reject) {
                memCons[k].connection.query(query, function (err, results) {
                    if (err) return reject(err);

                    resolve(results);
                });
            });
        });

        alt.on(`sql:${k}:queryAsync`, function (query) {
            if (!query) return;

            return new Promise(function (resolve, reject) {
                memCons[k].connection.query(query, function (err, results) {
                    if (err) return reject(err);

                    resolve(results);
                });
            });
        });
    }
}

export function remove(connection) {
    if (connection == "everything") {
        for (const [k, v] of Object.entries(memCons)) destroyConnection(k);
    } else destroyConnection(connection);
}

function destroyConnection(connection) {
    if (!memCons[connection] || memCons[connection]?.length === 0) return;

    log.warn(`SQL (${connection}) connection destroyed`, "CORE,SQL");

    memCons[connection].connection.destroy();

    alt.off(`sql:${connection}:query`, () => {});
    alt.off(`sql:${connection}:querySync`, () => {});
    alt.off(`sql:${connection}:queryAsync`, () => {});

    delete memCons[connection];
}

function handleDisconnect(connection) {
    connection.on("error", function (error) {
        if (!error.fatal) return;
        if (error.code !== "PROTOCOL_CONNECTION_LOST") throw error;

        log.warn(`SQL (${k}) lost connection. Reconnecting...`, "CORE,SQL");

        connection = mysql.createConnection(v);

        handleDisconnect(connection);

        connection.connect(function (err) {
            if (err)
                return log.error(`SQL (${k}) connection error`, "CORE,SQL");

            log.log(`SQL (${k}) successfully connected`, "CORE,SQL");
        });
    });
}
