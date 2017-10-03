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
const port = process.argv[2] ? parseInt(process.argv[2]) : 2003;

const kademliaPort = port + 1000;

// Setup storage.
storage.initSync();

app.post('/api/ds/register/:url', (req, firstRes, next) => {
    const url = req.params["url"]
    const wotId = generateId(url)

    findNodesKademlia(wotId, (nodes) => {
        const sortedClosest = nodes.sort((x, y) => (distance(wotId, x.id) - distance(wotId, y.id)))
        
        // Find peer responsible to new WoT.
        const resPeer = sortedClosest[0];
        const dsPort = resPeer.port - 1000;
        const dsIp = resPeer.ip;

        // Call WoT to indicate that it should report to this device.
        let options = {
            uri: "http://" + dsIp + ":" + dsPort + "/wot/register",
            method: "POST",
            headers: {
                "id": Math.floor(Math.random()*Math.pow(2,B)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
            },
            body: JSON.stringify({"ip": dsPort, "port": dsIp}),            
            json: true
        };

        request(options, (err,res,body) => {
            if (err !== undefined) {
                winston.debug(err);
                firstRes.statusCode(500).send(err);
                return;
            }

            // WoT has succesfully joined!
            firstRes.sendStatus(200);
        });
    })
})
    
app.post('/api/ds/storage/', (req, firstRes, next) => {

    const sensorData = req.body.sensorData;
    const isIterative = req.body.isIterative;
    const wotId = req.body.wotId;

    saveData(sensorData, wotId);

    if (!isIterative) {
        firstRes.sendStatus(200);
        return;
    }

    // Find k closest kademlia nodes, so we can get the k closest DS nodes.
    findNodesKademlia(wotId, (nodes) => {

         nodes.forEach(function(element) {
             let options = {
                uri: "http://" + element.ip + ":" + (element.ip - 1000) + "/api/ds/storage",
                method: "POST",
                headers: {
                    "id": Math.floor(Math.random()*Math.pow(2,8)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                },
                body: JSON.stringify({"data": sensorData, "wotId": wotId, "isIterative": false}),            
                json: true
            };

            request(options, (err,res,body) => {
                if (err !== undefined) {
                    winston.debug(err);
                    firstRes.statusCode(500).send(err);
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

    const data = storage.getItemSync(wotId);

    res.send(data);
})
    

app.listen(port, () => {
    console.log('Kademlia node listening on port ' + port + "!")
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
        if (err !== undefined) {
            winston.debug(err);         
            return;
        }
        winston.debug("Find nodes call on Kademlia API success: " + body.nodes);
        callback(body.nodes);
    });
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
 * Saves a new data point for the given wot id.
 * @param {*} data 
 * @param {*} wotId 
 */
function saveData(data, wotId) {
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
    let existingData = storage.getItemSync(wotId) || [];

    // Append the new data point object to the array of objects.
    const newDataPoint = { timestamp: Date.now(), data: data }
    existingData.push(newDataPoint);

    // Save the data.
    storage.setItemSync(wotId, existingData)

    winston.debug("Persisted data " + newDataPoint + " for id " + wotId)
}