const express = require('express');
const ip = require('ip');
const crypto = require('crypto');
const winston = require("winston");
const async = require("async");
const request = require("request");
const bodyParser = require("body-parser");
var storage = require('node-persist');

app.set("view engine", "pug");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = process.argv[2] ? parseInt(process.argv[2]) : 2003;

const kademliaPort = port + 1000;

// Setup storage.
storage.init();

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
            uri: "http://" + dsIp + ":" + dsPort + "/api/register",
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
                res.statusCode(500).send(err);
                return;
            }

            // WoT has succesfully joined!
            firstRes.sendStatus(200);
        });
    })
})
    
app.post('/api/ds/storage/', (req, firstRes, next) => {

    const sensorData = req.body.sensor;
    const isIterative = req.body.isIterative;
    const wotId = req.body.wotId;

    saveData(sensorData, wotId);

    if (!isIterative) {
        res.sendStatus(200);
        return;
    }

    // Find k closest kademlia nodes, so we can get the k closest DS nodes.
    findNodesKademlia(wotId, (nodes) => {

         nodes.forEach(function(element) {
             let options = {
                uri: "http://" + element.ip + ":" + (element.ip - 1000) + "/api/ds/storage",
                method: "POST",
                headers: {
                    "id": Math.floor(Math.random()*Math.pow(2,B)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                },
                body: JSON.stringify({"data": sensorData, "wotId": wotId, "isIterative": false}),            
                json: true
            };

            request(options, (err,res,body) => {
                if (err !== undefined) {
                    winston.debug(err);
                    res.statusCode(500).send(err);
                    return;
                }

                // Done!
                firstRes.sendStatus(200);
            });
         }, this);
    })
})

app.listen(port, () => {
    console.log('Kademlia node listening on port ' + port + "!")
})

function findNodesKademlia(wotId, callback) {
    let options = {
        uri: "http://127.0.0.1:" + kademliaPort + "/api/kademlia/nodes/" + wotId,
        method: "GET",
        headers: {
            "id": Math.floor(Math.random()*Math.pow(2,B)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
        },
        json: true
    };
    
    request(options, (err,res,body) => {
        if (err !== undefined) {
            winston.debug(err);
            res.statusCode(500).send(err);            
            return;
        }

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

function saveData(data, id) {
    // Save data somehow.
}