const express = require('express');
const ip = require('ip');
const crypto = require('crypto');
const winston = require("winston");
const async = require("async");
const request = require("request");
const bodyParser = require("body-parser");
var storage = require('node-persist');
const app = express();

app.set("view engine", "pug");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = process.argv[2] ? parseInt(process.argv[2]) : 2005;
const myIp = ip.address()

const kademliaPort = port + 1000;
var timers = {}

// Setup storage.
storage.initSync();

app.get("/api/ds/HistoricalData/:id", (req, res) => {
    let reqID = (req.params["id"])
    const data = storage.getItemSync(reqID + "_ds").sort((x,y) => x.timestamp - y.timestamp);

	winston.debug(data);

    if(req.header("Accept") === "application/json") {
        res.send(JSON.stringify(data))
    }
    else {
        res.render("wot-ds", {
            rData: data
        });
    }
})

app.post('/api/ds/register/:url', (req, firstRes, next) => {
    const sensorUrl = req.params["url"]
    const wotId = generateId(sensorUrl)

    findNodesKademlia(wotId, (nodes) => {
        nodes.push({ port: port, ip: myIp})
        
        const sortedClosest = nodes.sort((x, y) => (distance(wotId, x.id) - distance(wotId, y.id)))
                

        // Find peer responsible to new WoT.
        const resPeer = sortedClosest[0];
        const dsPort = resPeer.port;
        const dsIp = resPeer.ip;

        let options = {
            uri: "http://" + sensorUrl + "/wot/register",
            method: "POST",
            headers: {
                "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
            },
            body: {"ip": dsIp, "port": dsPort.toString()},            
            json: true
        };

        request(options, (err,res,body) => {
            if (err !== undefined && err !== null) {
                winston.debug(err);
                firstRes.status(500).send(err);
                return;
            }
            winston.info("Succesfully registered wot device: " + wotId)
            // WoT has succesfully joined!
            firstRes.sendStatus(200);
        });
    })
})
    
app.post('/api/ds/storage/', (req, firstRes, next) => {

    const sensorData = req.body.sensorData;
    const isIterative = req.body.isIterative;
    const wotId = req.body.wotId;
    const timestamp = req.body.timestamp;
    const wotIp = req.body.wotIp;
    const wotPort = req.body.wotPort;

    saveData(sensorData, wotId, timestamp);
    
    // If this is the node responsible for the wot device (this call is iterative), save it's meta data to Kademlia.
    if (isIterative) {
        saveMetadata(wotIp, wotId, wotPort)
    } else {
        // Start timer for the wotId.
        setupTimer(wotId);

        firstRes.sendStatus(200);
        return;
    }

    // Find k closest kademlia nodes, so we can get the k closest DS nodes.
    findNodesKademlia(wotId, (nodes) => {

         nodes.forEach(function(element) {
             let options = {
                uri: "http://" + element.ip + ":" + (element.port - 1000) + "/api/ds/storage",
                method: "POST",
                headers: {
                    "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                },
                body: {"timestamp": timestamp, "sensorData": sensorData, "wotId": wotId, "isIterative": false},            
                json: true
            };

            request(options, (err,res,body) => {
                if (err !== undefined && err !== null) {
                    winston.debug(err);
                    firstRes.status(500).send(err);
                    return;
                }

                // Done!
                firstRes.sendStatus(200);
            });
         }, this);
    })
})

app.get('/api/ds/storage/:wotId', (req, res, next) => {
    const wotId = req.params["wotId"];
    
    const data = storage.getItemSync(wotId + "_ds");

    res.send(data);
})  

app.get('/api/ds/ping', (req,res) => {
    res.sendStatus(200);
    winston.info("Ping recieved from " + req.hostname + ":" + req.port);
})

app.listen(port, () => {
    console.log('Wot-DS node listening on port ' + port + "!")
})

/**
 * Call the FIND_NODE from the Kademlia API 
 * @param {*} wotId 
 * @param {*} callback 
 */
function findNodesKademlia(wotId, callback) {
    let options = {
        uri: "http://127.0.0.1:" + kademliaPort + "/api/kademlia/nodes/" + wotId,
        method: "GET",
        headers: {
            "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
        },
        json: true
    };
    
    request(options, (err,res,body) => {
        if (err !== undefined && err !== null) {
            winston.debug(err);         
            return;
        }
        winston.debug("Find nodes call on Kademlia API success: " + body.nodes);
        callback(body.data);
    });
}

function setupTimer(wotId) {
    // Hopefully timers are async
    // Remember to change seconds to depend on sensor metadata updaterate.
    //setTimeout takes: (called function), time, (param1 to function), etc...
    if(timers[wotId] !== undefined && timers[wotId] !== null) {
        clearTimeout(timers[wotId])
    }
    timers[wotId] = setTimeout(recovery, 10000, wotId)
}

/**
 * Recovery function that is triggered when data is no longer received from a sensor (through a ds node).
 * @param {*} wotId 
 */
function recovery(wotId) {
    let options = {
        uri: "http://127.0.0.1:" + kademliaPort + "/api/kademlia/value/"+wotId,
        method: "GET",
        headers: {
            "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
        },            
        json: true
    };

    request(options, (err,res,body) => {
        if (err !== undefined && err !== null) {
            winston.debug(err);
            firstRes.status(500).send(err);
            return;
        }
        wotIp = body.data.wotIp;
        wotPort = body.data.wotPort;
        dsIp = body.data.dsIp;
        dsPort = body.data.dsPort;

        pingNode(dsIp, dsPort, (success) => {
            // If it's dead, register the sensor again.
            if (!success) {
                let options = {
                    uri: "http://127.0.0.1:" + port + "/api/ds/register/" + wotIp + ":" + wotPort,
                    method: "POST",
                    headers: {
                        "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                    },            
                    json: true
                };
            
                request(options, (err,res,body) => {
                    if (err !== undefined && err !== null) {
                        winston.debug(err);
                        firstRes.status(500).send(err);
                        return;
                    }
                    
                    winston.info("Register success for sensor " + wotIp + ":" + wotPort)
                })
            } else {
                winston.info(dsIp + ":" + dsPort + " is still alive! Yay!")
            }
        })
    })
}

/**
 * Pings a ds node with the given IP and port. Callback returns either false or true.
 * @param {*} ip 
 * @param {*} port 
 * @param {*} callback 
 */
function pingNode(ip, port, callback) {
    let options = {
        uri: "http://" + ip + ":" + port + "/api/ds/ping",
        method: "GET",
        headers: {
            "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
        },            
        json: true
    };

    request(options, (err,res,body) => {
        if (err !== undefined && err !== null) {
            winston.debug(err);
            callback(false);
            return;
        }
        winston.info("Succesful ping to " + ip + ":" + port)        
        callback(true);
    })
}


/**
 * Generates id
 */
function generateId(text) {
    const hash = crypto.createHash("sha256").update(text).digest("hex");
    const bin = hex2bin(hash);
    const sub = bin.substring(0, 8);
    const binId = parseInt(sub);
    id = bin2Dec(binId);
    return id;
}

/**
 * Saves metadata about the wot device to kademlia.
 * @param {*} wotIp 
 * @param {*} wotPort 
 */
function saveMetadata(wotIp, wotId, wotPort) {
    let options = {
        uri: "http://127.0.0.1:" + kademliaPort + "/api/kademlia/storage-iterative/",
        method: "POST",
        headers: {
            "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
        },
        body: {
            key: wotId.toString(),
            data: {
                "dsIp": myIp,
                "dsPort": port,
                "wotIp": wotIp,
                "wotPort": wotPort
            }
        },            
        json: true
    };

    request(options, (err,res,body) => {
        if (err !== undefined && err !== null) {
            winston.debug(err);
            firstRes.status(500).send(err);
            return;
        }
        
        winston.info("Saved metadata in Kademlia for " + wotId)
    }) 
}

/**
 * Saves a new data point for the given wot id.
 * @param {*} data 
 * @param {*} wotId 
 */
function saveData(data, wotId, timestamp) {
    // We use node-persist for storage.
    // The data is saved with the wot id as the key.
    // The value is a dictionary of timestamp (EPOCH) + sensor-data.
    //
    //   Example of temperature data of wot device with id 123
    // Stored for key 123
    // [
    //      { timestamp: 223452345, data: 24.5 },
    //      { timestamp: 123123123, data: 24.6 }
    // ]   

    // Get the data for the wot id.
    let existingData = storage.getItemSync(wotId + "_ds") || [];

    // Append the new data point object to the array of objects.
    const newDataPoint = { timestamp: timestamp, data: data }
    existingData.push(newDataPoint);

    // Save the data.
    storage.setItemSync(wotId + "_ds", existingData)

    winston.info("Persisted data " + newDataPoint + " for id " + wotId)
}

function distance(a, b) {
    return parseInt(a) ^ parseInt(b);
}

/**
 * https://stackoverflow.com/questions/45053624/convert-hex-to-binary-in-javascript
 * @param {*} hex 
 */
function hex2bin(hex){
    return (parseInt(hex, 16)).toString(2);
}

/**
 * https://stackoverflow.com/questions/7695450/how-to-program-hex2bin-in-javascript
 * @param {*} n 
 */
function bin2Dec(bin) {
    return parseInt(bin,2).toString(10)
}