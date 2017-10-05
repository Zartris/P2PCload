const express = require('express');
const ip = require('ip');
const crypto = require('crypto');
const winston = require("winston");
const async = require("async");
const request = require("request");
const bodyParser = require("body-parser");
var storage = require('node-persist');

const app = express();

winston.level = "debug";
winston.debug("Logging in " + winston.level + " mode");

class Triple {
    constructor(ip, port, id) {
        this.ip = ip;
        this.port = port;
        this.id = id;
    }

    toString() {
        return "<" + this.ip + "," + this.port + "," + this.id + ">"
    }
}

class Bucket {
    constructor(triple, k) {
        this.triples = [triple];
        this.k = k;
    }

    toString() {
        return this.triples.join();
    }

    contains(triple) {
        winston.silly(this.triples.map(JSON.stringify) + "; " + JSON.stringify(triple));
        winston.silly(this.triples.map(JSON.stringify).includes(JSON.stringify(triple)));
        return this.triples.map(JSON.stringify).includes(JSON.stringify(triple))
    }

    put(triple) {
        if(!this.contains(triple)) {
            if(this.triples.length < k) {
                this.triples.push(triple);
            }
            else {
            leastRecentTriple = this.triples[0];
            let options = {
                uri: "http://" + leastRecentTriple.ip + ":" + leastRecentTriple.port + "/api/kademlia/ping",
                method: "POST"
            };
            var that = this; //WHAT?!
            request(options, (err,res,body) => {
                winston.debug("PING of" + leastRecentTriple.id + " returned response " + res.statusCode);
                if(err || res.statusCode != 200) {
                    winston.info("Dead triple removed: " + leastRecentTriple)
                    that.triples.splice(0);
                    that.triples.push(triple);
                }
            });
            }   
        }
        else {
            if(!this.triples[this.triples.length-1].id === triple.id) {
            let index = this.triples.map(JSON.stringify).indexOf(JSON.stringify(triple));
            this.triples.splice(index);
            this.triples.push(triple);
            }
        }
    }

}

app.set("view engine", "pug");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = process.argv[2] ? parseInt(process.argv[2]) : 3005;
const connectToIp = process.argv[3];
const connectToPort = process.argv[4];
const connectToId = process.argv[5];
const alpha = process.argv[6] ? parseInt(process.argv[3]) : 3;
const B = process.argv[7] ? parseInt(process.argv[4]) : 8;
const k = process.argv[8] ? parseInt(process.argv[5]) : 10;

var id = undefined;
generateId();
var buckets = [];

// Try to join the network if we have the join-triple.
if ((connectToIp && connectToId && connectToPort) !== undefined) {
    let joinOnTriple = new Triple(connectToIp, connectToPort, connectToId)
    joinNetwork(joinOnTriple, () => { })
}

// Setup storage.
storage.init();
//storage.setItemSync("42", "Test item")

//This process ensures that the persistent storage is not, in fact, persistent
//TODO: Determine whether storage should really be persistent, as it could make the network kinda volatile
process.on('SIGINT', () => {
    storage.clearSync();
    winston.info("Persistent storage wiped") 
    process.exit();
  });


/**
 * Joins the kademlia network.
 */
app.post('/api/kademlia/join', (req, res, next) => {
    // Put known in bucket
    var joinTriple;
    if (req.body.node_id === undefined){ // A disturbingly slapdash way of deciding whether the request is coming from a browser
        joinTriple 
            = new Triple(req.header("node_address"), req.header("node_port"), req.header("node_id"));
    }
    else {
        joinTriple
            = new Triple(req.body.node_address, req.body.node_port, req.body.node_id)
    }

    joinNetwork(joinTriple, () => {
        res.statusCode = 200;
        res.redirect("/api/kademlia")
    })
})

/**
 * Overview page
 */
app.get('/api/kademlia', (req, res) =>{
        let keys = storage.keys();
        keys = keys.filter( (element) => !element.includes("_ds"));
        res.render("index", {
        nodeid: id, 
        bucketlist: buckets, 
        nodeaddress: ip.address(), 
        nodeport: port,
        storage: storage.values().map((x,i) => {
            return [keys[i], x] // Zipping the two arrays for the UI
        })} // Note: Unbouned result set. Change to avoid explosions
    );
    winston.info("Node overview accessed by " + req.hostname);
})

/**
 * 
 * @api {get} /api/kademlia/nodes/:id  Retrieves the k closest nodes to the specified ID.
 * @apiName FindNodes
 * @apiGroup Milestone1
 * @apiVersion 1.0.1
 * @apiDescription Corresponds to the Kademlia FIND_NODE as specified in the specification.

 * 
 * @apiHeader {String} node_address The address for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_port The port for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_id The ID for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} id Random RPC ID
 * 
 * @apiParam  {String} id The ID of the node you want the k closest nodes to.
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101, id: 123}
 * 
 * @apiSuccess (200) {Triple[]} array the k closest nodes
 * 
 * @apiSuccessExample {Triple[]} Success-Response-Example:
    {
    "type": "nodes",
    "data": [
        {
            "ip": "192.168.0.114",
            "port": "3004",
            "id": "108"
        }
    ]
}
 *
 */
app.get('/api/kademlia/nodes/:id', (req, res) => {
    var reqID = parseInt(req.params["id"]);
    winston.debug("Requested ID: " + reqID);
    var closest = getNClosest(reqID, k);
    
    const randID = req.header("id");
    if(randID === undefined) {
        res.status(400).send("Random ID not defined")
        return;
    }
    let triple = new Triple(req.header("node_address"), req.header("node_port"),req.header("node_id"));
    if(triple.id != undefined) putTripleInBucket(triple);

    // Don't include the requester node in the 'closest' array.
    var newClosest = closest.filter( (trpl) => {
        return trpl.id !== triple.id
    })

    // Create response body.
    const resBody = {
        "type": "nodes",
        "data": newClosest
    }

    res.contentType("application/json");
    res.setHeader("id", randID);
    res.statusCode = 200;
    res.send(JSON.stringify(resBody));
    winston.info("FIND_NODE(" + reqID + ") from " + triple + " returned " + (closest.map((x) => x.id) ? closest : "nothing!"))
})

/**
 * 
 * @api {post} /api/kademlia/ping Pings the node.
 * @apiName Ping
 * @apiGroup Milestone1
 * @apiVersion 1.0.1
 * @apiDescription Corresponds to the Kademlia PING as specified in the specification. Returns a PONG (status 200). Puts the requester in this node's bucket.
 * 
 * @apiHeader {String} node_address The address for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_port The port for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_id The ID for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} id Random RPC ID
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101, id: 123}
 * 
 */
app.post('/api/kademlia/ping', (req,res) => {
    const randID = req.get("id");
    if(randID === undefined) {
        res.status(400).send("Random ID not defined")
    }
    res.writeHead(200 , {"id": randID}); // Remember to return random ID
    let triple = new Triple(req.header("node_address"),req.header("node_port"),req.header("node_id"));
    putTripleInBucket(triple);
    res.send();
    winston.info("Ping recieved from " + req.hostname + ":" + req.port);
})

/**
 * 
 * @api {post} /api/kademlia/storage
 * @apiName STORE
 * @apiGroup Milestone3
 * @apiVersion 1.0.1
 * @apiDescription Corresponds to the Kademlia STORE as specified in the specification. This version is not iterative.
 * 
 * @apiHeader {String} node_address The address for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_port The port for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_id The ID for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} id Random RPC ID
 * @apiParam {String} key The key intended for storage
 * @apiParam {String} data The data intended for storage
 */
// Should we perhaps just generate keys based on a hash of the data?
app.post('/api/kademlia/storage', (req,res) => {
    // There should be a body (the data).
    winston.debug(req.body)
    if (req.body === undefined || req.body.key === undefined || req.body.data === undefined) {
        res.status(400).send("Malformed request: " + req.body.key + "," + req.body.data);
        return;
    }
    //Get the required key
    const key = req.body.key
    const data = req.body.data
    let triple = new Triple(req.header("node_address"),req.header("node_port"),req.header("node_id"));
    if(triple.id !== undefined) putTripleInBucket(triple)
    // Store the body.
    storage.setItemSync(key, data);

    res.status(200).send("Data stored succesfully with key " + key);
    winston.info("STORE operation recieved from " + req.hostname + ":" + req.port + " for key " + key);
})

/**
 * 
 * @api {post} /api/kademlia/storage.iterative
 * @apiName STORE
 * @apiGroup Milestone3
 * @apiVersion 1.0.1
 * @apiDescription Corresponds to the Kademlia STORE as specified in the specification. This version is iterative, and makes STORE RPC's to the k nearest nodes.
 * 
 * @apiHeader {String} node_address The address for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_port The port for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} node_id The ID for the contacting node, should this be specified, the triple will be updated in the bucket list
 * @apiHeader {String} id Random RPC ID
 * @apiParam {String} key The key intended for storage
 * @apiParam {String} data The data intended for storage
 */
app.post('/api/kademlia/storage-iterative/', (req,res) => {

    // There should be a body (the data).
    if (req.body === undefined || req.body.key === undefined || req.body.data === undefined) {
        res.status(400).send("Malformed request");
        return;
    }
    //Get the provided key
    const key = req.body.key
    const data = req.body.data

    // Store the body.
    storage.setItemSync(key, data);

    var that = this;
    nodeLookup(id, false, (resultTriples) => {

        // Unwrap triples from structure
        resultTriples = resultTriples.data;

        // Put all the new triples into buckets.
        resultTriples.forEach((triple) => {
            putTripleInBucket(triple) // I have a sneaking suspicion they'd all already be there
        })

        // Send STORE to each of the triples.
        async.map(resultTriples, (triple, mapCallback) => {
            let options = {
                uri: "http://" + triple.ip + ":" + triple.port + "/api/kademlia/storage",
                method: "POST",
                headers: {
                    "node_id": id,
                    "node_port": port,
                    "node_address": ip.address(),
                    "id": Math.floor(Math.random()*Math.pow(2,B)) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                },
                body: req.body,
                json: true
            };
            
            request(options, (err,res,body) => {
                if(err) winston.error(err)
                winston.debug("STORE to " + triple.id + " returned response " + res.status);
                mapCallback(err);
            });
            
        }, (err, results) => {
            // All STORE calls finised
            res.status(200).send("Data stored (iteravely) succesfully with key " + key);
            winston.info("Iterative store completed succesfully");
        });
    })
})

/**
 * 
 * @api {get} /api/kademlia/value/:id Attempts to find the specified value locally 
 * @apiName FIND_VALUE
 * @apiGroup Milestone3
 * @apiVersion 1.0.1
 * @apiDescription Corresponds to the Kademlia FIND_NODE as specified in the specification, excluding the iteration.

 * 
 * @apiHeader {String} node_address description
 * @apiHeader {String} node_port description
 * @apiHeader {String} node_id description
 * @apiHeader  {String} id Random RPC ID
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101, id: 123}
 * 
 * @apiParam {String} id The key intended for search
 * 
 * @apiSuccess (200) {Triple[]} array the k closest nodes
 * 
 * @apiSuccessExample {Triple[]} Success-Response-Example:
    {
    "type": "nodes",
    "data": [
        {
            "ip": "192.168.0.114",
            "port": "3004",
            "id": "108"
        }
    ]
    }

    @apiSuccessExample {Triple[]} Success-Response-Example:
    {
    "type": "value",
    "data": "Hello"
    }
 */
app.get('/api/kademlia/value/:id', (req,res) => {
    const id = req.params["id"];

    // Check if we have the data.
    const data = storage.getItemSync(id);

    var resBody;
    if (data === undefined) {
        // We don't have the value - return the k closest nodes.
        const closest = getNClosest(id, k);

        // Create data structure for NODES RETURN.
        resBody = generateDataStructure(true, closest)
    } else {
        // We have the value here - return it.

        // Create data structure for VALUE RETURN.
        resBody = generateDataStructure(false, data)
    }
    res.status(200).send(JSON.stringify(resBody));            
})

/**
 * 
 * @api {get} /api/kademlia/value/:id Attempts to find the specified value iteratively through the network
 * @apiName FIND_VALUE
 * @apiGroup Milestone3
 * @apiVersion 1.0.1
 * @apiDescription Corresponds to the Kademlia FIND_NODE as specified in the specification, including the iteration.

 * 
 * @apiHeader {String} node_address description
 * @apiHeader {String} node_port description
 * @apiHeader {String} node_id description
 * @apiHeader  {String} id Random RPC ID
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101, id: 123}
 * 
 * @apiParam {String} id The key intended for search
 * 
 * @apiSuccess (200) {Triple[]} array the k closest nodes
 * 
 * @apiSuccessExample {Triple[]} Success-Response-Example:
    {
    "type": "nodes",
    "data": [
        {
            "ip": "192.168.0.114",
            "port": "3004",
            "id": "108"
        }
    ]
    }

    @apiSuccessExample {Triple[]} Success-Response-Example:
    {
    "type": "value",
    "data": "Hello"
    }
 */
app.get('/api/kademlia/iterative-value/:id', (req,res) => {
    const reqID = req.params["id"];
    // Check if we have the data.
    const data = storage.getItemSync(reqID);
    if(data !== undefined) {
        res.status(200).send(JSON.stringify(generateDataStructure(false, reqID)))
        return;
    }

    nodeLookup(id, true, (result) => {

        // If we found the value, store the value at the closest node.
        if (result.type === "value") {
            const value = result.data; //This was called "triples" before, which I don't qute get due to the immediate redefinition
            triples = getNClosest(reqID, k);
            if (triples.length > 0 ) {
                const closest = triples[0];

                // Send STORE to the closest node.
                let options = {
                    uri: "http://" + closest.ip + ":" + closest.port + "/api/kademlia/store/",
                    method: "POST",
                    headers: {
                        "node_id": id,
                        "node_port": port,
                        "node_address": ip.address(),
                        "id": Math.random()*Math.pow(2,B) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                    },
                    body: JSON.stringify({"key": reqID, "data": value}),
                    json: true
                };
                
                request(options, (err,res,body) => {
                    winston.debug("STORE to" + triple.id + " returned response " + res.statusCode);

                    // Send the value back to the requester.
                    res.status(200).send(JSON.stringify(result));
                });
            }
        } else {
            res.status(200).send(JSON.stringify(result));
        }
    });               
})

app.listen(port, () => {
    console.log('Kademlia node listening on port ' + port + "!")
})

/**
 * Joins the network with the supplied triple. Calls the callback when done.
 * @param {*} joinTriple 
 * @param {*} callback 
 */
function joinNetwork(joinTriple, callback) {
    putTripleInBucket(joinTriple);
    winston.info("Join " + joinTriple.toString());
    // iterateFindNode on this

    nodeLookup(id, false, (resultTriples) => {
        // Unwrap triples.
        resultTriples = resultTriples.data;

        // Put all the new triples into buckets.
        resultTriples.forEach((triple) => {
            putTripleInBucket(triple)
        })

        callback();
    })
}

/**
 * Technically iterativeNodeLookup
 * @param {*} id 
 */
function nodeLookup(reqID, isValueLookup, finalCallback) {
    var shortlist = getNClosest(reqID, k).sort((x, y) => (distance(reqID, x.id) - distance(reqID, y.id))); // I figure sorting this list by distance makes sense given the circumstances
    var remainder = shortlist.splice(alpha, k)
    var nodesContacted = [];
    var closestNode = shortlist[0]; // This is now technically correct
    var closestNodeChanged = false;

    // Closure for making the FIND_NODE/FIND_VALUE calls.
    function makeFindNodeCalls(triples, callback) {
        let allResults = []; //Put actual results here (remember to exclude duplicates)

        // Add the contacted nodes to the array.
        nodesContacted.concat(triples);
        remainder.filter((x) => triples.map(JSON.stringify).indexOf(JSON.stringify(x)) === -1)

        async.map(triples, (triple, mapCallback) => {
            let options = {
                uri: isValueLookup ? ("http://" + triple.ip + ":" + triple.port + "/api/kademlia/value/" + reqID) : ("http://" + triple.ip + ":" + triple.port + "/api/kademlia/nodes/" + reqID),
                headers: {
                    "node_id": id,
                    "node_port": port,
                    "node_address": ip.address(),
                    "id": Math.random()*Math.pow(2,B) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                },
                method: "GET"
            };
            winston.debug("Calling " + (isValueLookup ? "FIND_VALUE" : "FIND_NODE") + " on "  + triple + "...")
            request(options, (err, res, body) => {
                if(!err && res.statusCode === 200) {
                    let results = JSON.parse(body);
                    winston.debug(isValueLookup ? "FIND_VALUE" : "FIND_NODE" + triple + " returned <" + results + ">");
                    
                    // If this is a value lookup, check for data.
                    if (results.type === "value") {
                        // WE HAVE THE DATA!!

                        // Return the data
                        finalCallback(results)
                        return;
                    }

                    // This is nodes - extract them from the data structure.
                    results = results.data;

                    // Update closest node
                    results = results.sort((x, y) => (distance(reqID, x.id) - distance(reqID, y.id))).filter((x) => x.id != id) //Might as well remove any instance of ourselves
                    // The closest node is now in the front.

                    let closestFromCurrentRequest = results[0];
                    if (closestFromCurrentRequest && distance(reqID, closestFromCurrentRequest.id) < distance(reqID, closestNode.id)) {
                        // We have found a new closer node!
                        closestNode = closestFromCurrentRequest; // Will this bring concurrency issues? I understand that Node.js is single-threaded, but this is async after all
                        closestNodeChanged = true;
                    } 

                    mapCallback(err, results);
                } else {

                    // Callback with empty array.
                    mapCallback(err, []);
                }
            })
        },
        (err, results) => {
            // When all calls are finished (basically, this version waits)
            allResults = allResults.concat.apply([],results); //Flatten the array of arrays (the set technique doesn't seem very eficient, but it works

            // Add the results from this iteration to the shortlist.
            shortlist = shortlist.concat(allResults);
            winston.debug("Node lookup results: <" + shortlist.map((x)=>x.id) + ">")

            // Sort the updated shortlist
            shortlist = shortlist.sort((x, y) => (distance(reqID, x.id) - distance(reqID, y.id))).filter( (el, i, arr) => arr.map(JSON.stringify).indexOf(JSON.stringify(el)) === i);// Change this to (our own) id? [Nah, our id isn't important for this. We want it relative to the call]

            callback()
        })
    }


    function nodeLookupIteration(triplesToRequest) {
        // Reset closest node flag.
        closestNodeChanged = false;

        // Make call (with alpha nodes)
        makeFindNodeCalls(triplesToRequest, () => {
            
            if (shortlist.length === k) {
                // We have not seen something closer, or we have k active contacts! Start final process.

                // Create data structure.
                const struct = generateDataStructure(true, shortlist)
                finalCallback(struct);
            } else if(!closestNodeChanged) {
                if(remainder.length === 0) 
                    finalCallback(generateDataStructure(true, shortlist))
                else 
                makeFindNodeCalls(remainder, () => {
                    winston.debug("Remaining nodes called: " + remainder.map((x) => x.id))
                    finalCallback(generateDataStructure(true, shortlist))
                })
            } else {
                // We have discovered a new closest node. Continue the process.

                // Select alpha new from the shortlist
                let newNodesToCall = [];
                for(let i = 0; i < shortlist.length; i++) {
                    let currentNode = shortlist[i];

                    // Check if already have contacted this node before.
                    if (nodesContacted.map(JSON.stringify).includes(JSON.stringify(currentNode))   /*nodesContacted.contains(currentNode)*/) {
                        continue;
                    }

                    newNodesToCall.push(currentNode);

                    // Stop iteration if we have alpha nodes
                    if (newNodesToCall.length === alpha) {
                        break;
                    }
                }

                // Make new iteration.
                nodeLookupIteration(newNodesToCall);
            }
        })
    }

    // Start the first iteration by calling the whole shortlist (of length alpha)
    nodeLookupIteration(shortlist)

    // ---------
    // Perform alpha async FIND_NODE calls

    // let kBestResults = allResults.sort((x, y) => (distance(reqID, x.id) - distance(reqID, id.y))).splice(0,k);
    //🍔
    // Aggregate k closest results (sort results by distance and take the first k)
    // Perform async FIND_NODE on alpha closest of the k
    // Continue until nothing new is established
}

/**
 * I actually hate this implementation, but I'm tired, and I found a bug
 * 
 * EDIT: Turns out my hate was not unfounded. It was bugged.
 * @param {*} reqID 
 * @param {*} n 
 */
function getNClosest(reqID, n) {
    let dist = distance(id, reqID);
    let bucketNumber = dist === 0 ? 0 : Math.floor(Math.log2(dist));
    let closest = [];
    if(buckets[bucketNumber] instanceof Bucket) {
        closest = closest.concat(buckets[bucketNumber].triples)
    }
    let top = bucketNumber + 1
    let bot = bucketNumber - 1
    while(closest.length < n && (bot >= 0 || top < B)) {
        if(buckets[bot] instanceof Bucket && bot >= 0)
        closest = closest.concat(buckets[bot].triples)
        if(buckets[top] instanceof Bucket && top < B)
        closest = closest.concat(buckets[top].triples)
        bot--
        top++
    }
    winston.silly("Closest: " + closest)
    return closest;
}

/**
 * Generates this node's ID and stores it in the global "id"
 */
function generateId() {
    var address = ip.address();
    const hash = crypto.createHash("sha256").update(address + port).digest("hex");
    winston.debug("Hash for " + address + ":" + port + " = " + hash );
    const bin = hex2bin(hash);
    const sub = bin.substring(0, B-1);
    const binId = parseInt(sub);
    id = bin2Dec(binId);
    winston.info("Node ID: " + id);
}

function putTripleInBucket(triple) {
    if (triple.id === id) {
        winston.debug("Attempted to add self to bucket");
        return;
    }
    const dist = distance(id, triple.id);
    const i = dist === 0 ? 0 : Math.floor(Math.log2(dist));

    if (buckets[i] instanceof Bucket) {
        buckets[i].put(triple);
        winston.debug("Added " + triple.id + " to bucket " + i + " (" + buckets[i].toString() + ")")
    } else {
        buckets[i] = new Bucket(triple, k);
        winston.debug("New bucket created (" + buckets[i].toString() + ")")
    }
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

/**
 * A little data structure for the sake of discerning between data and node returns. This is mostly used to enhance code reusde
 * @param {*} isNodes 
 * @param {*} data 
 */
function generateDataStructure(isNodes, data) {
    return {
        type: isNodes ? "nodes" : "value",
        data: data
    }
}