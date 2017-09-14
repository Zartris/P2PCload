const express = require('express');
const ip = require('ip');
const crypto = require('crypto');
const winston = require("winston");
const async = require("async");
const request = require("request");
const bodyParser = require("body-parser");

const app = express();

winston.level = "debug";
winston.debug("Logging in debug mode");

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
                host: leastRecentTriple.address,
                port: leastRecentTriple.port,
                path: "/api/kademlia/ping",
                method: "POST"
            };
            var that = this; //WHAT?!
            request(options, (err,res,body) => {
                winston.debug("PING of" + leastRecentTriple.id + " returned response " + res.statusCode);
                if(err || res.statusCode != 200) {
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
app.use(bodyParser.urlencoded({extended: true}));
app.use("/static", express.static("/public"));
const port = process.argv[2] ? parseInt(process.argv[2]) : 3003;
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
/**
 * Joins the kademlia network.
 */
app.post('/api/kademlia/join', (req, res, next) => {
    // Put known in bucket
    var joinTriple
    if (req.body.node_id === undefined){ // A disturbingly slapdash way of deciding whether the request is coming from a browser
        joinTriple 
            = new Triple(req.header("node_address"), 
                    req.header("node_port"), 
                    req.header("node_id"));
    } else {
    joinTriple 
        = new Triple(req.body.node_address, 
                    req.body.node_port, 
                    req.body.node_id);
    }

    joinNetwork(joinTriple, () => {
        res.statusCode = 200;
        res.render("joined", {
            nodeid: id, 
            bucketlist: buckets, 
            nodeaddress: ip.address(), 
            nodeport: port});
        res.send();
    })
})

/**
 * Overview page
 */
app.get('/api/kademlia', (req, res) =>{
        res.render("index", {
        nodeid: id, 
        bucketlist: buckets, 
        nodeaddress: ip.address(), 
        nodeport: port});
    winston.info("Node overview accessed by " + req.hostname);
})

/**
 * 
 * @api {get} /api/kademlia/nodes/:id  Retrieves the k closest nodes to the specified ID.
 * @apiName FindNodes
 * @apiGroup Milestone1
 * @apiVersion 1.0.0
 * @apiDescription Corresponds to the Kademlia FIND_NODE as specified in the specification.

 * 
 * @apiHeader {String} node_address description
 * @apiHeader {String} node_port description
 * @apiHeader {String} node_id description
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101 }
 * 
 * @apiParam  {String} id The ID of the node you want the k closest nodes to.
 * @apiSuccess (200) {Triple[]} array the k closest nodes
 * 
 * @apiSuccessExample {Triple[]} Success-Response-Example:
    [{ ip = "192.168.0.102", port = 3000, id = 101 }, { ip = "192.168.0.102", port = 3001, id = 155  }]
 *
 */
app.get('/api/kademlia/nodes/:id', (req, res) => {
    var reqID = parseInt(req.params["id"]);
    winston.debug("Requested ID: " + reqID);
    var closest = getNClosest(reqID, k);
    
    const randID = req.get("id");
    let triple = new Triple(req.header("node_address"),req.header("node_port"),req.header("node_id"));
    if(triple.id != undefined) putTripleInBucket(triple);

    // Don't include the requester node in the 'closest' array.
    var newClosest = closest.filter( (trpl) => {
        return trpl.id !== triple.id
    })

    res.contentType("application/json");
    res.setHeader("id", randID);
    res.statusCode = 200;
    res.send(JSON.stringify(newClosest));
    winston.info("FIND_NODE(" + reqID + ") from " + triple + " returned " + (closest.map((x) => x.id) ? closest : "nothing!"))
})

/**
 * 
 * @api {post} /api/kademlia/ping Pings the node.
 * @apiName Ping
 * @apiGroup Milestone1
 * @apiVersion 1.0.0
 * @apiDescription Corresponds to the Kademlia PING as specified in the specification. Returns a PONG (status 200). Puts the requester in this node's bucket.
 * 
 * @apiHeader {String} node_address description
 * @apiHeader {String} node_port description
 * @apiHeader {String} node_id description
 * 
 * 
 * @apiHeaderExample {String} Request-Example (Headers):
   { node_address: 192.168.0.102, node_port: 3000, node_id: 101 }
 * 
 */
app.post('/api/kademlia/ping', (req,res) => {
    const randID = req.get("id");
    res.writeHead(200 , {"id": randID}); // Remember to return random ID
    let triple = new Triple(req.header("node_address"),req.header("node_port"),req.header("node_id"));
    putTripleInBucket(triple);
    res.send();
    winston.info("Ping recieved from " + req.hostname + ":" + req.port);
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

    nodeLookup(id, (resultTriples) => {
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
function nodeLookup(reqID, finalCallback) {
    var shortlist = getNClosest(reqID, k).sort((x, y) => (distance(reqID, x.id) - distance(reqID, y.id))); // I figure sorting this list by distance makes sense given the circumstances
    var remainder = shortlist.splice(alpha, k)
    var nodesContacted = [];
    var closestNode = shortlist[0]; // This is now technically correct
    var closestNodeChanged = false;

    // Closure for making the FIND_NODE calls.
    function makeFindNodeCalls(triples, callback) {
        let allResults = []; //Put actual results here (remember to exclude duplicates)

        // Add the contacted nodes to the array.
        nodesContacted.concat(triples);
        remainder.filter((x) => triples.map(JSON.stringify).indexOf(JSON.stringify(x)) === -1)

        async.map(triples, (triple, mapCallback) => {
            let options = {
                //host: triple.address,
                //path: "/api/kademlia/nodes/" + triple.id,
                uri: "http://" + triple.ip + ":" + triple.port + "/api/kademlia/nodes/" + triple.id,
                headers: {
                    "node_id": id,
                    "node_port": port,
                    "node_address": ip.address(),
                    "id": Math.random()*Math.pow(2,B) //TODO: This is a placeholder. Replace this with actual safe randomizer,
                },
                method: "GET"
            };
            winston.debug("Calling FIND_NODE on " + triple + "...")
            request(options, (err, res, body) => {
                if(!err && res.statusCode === 200) {
                    let results = JSON.parse(body);
                    winston.debug("FIND_NODE on " + triple + " returned <" + results + ">");
                    
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

                // TODO: Not sure what to do here.
                finalCallback(shortlist);
            } else if(!closestNodeChanged) {
                if(remainder.length === 0) finalCallback(shortlist)
                else makeFindNodeCalls(remainder, () => {
                    winston.debug("Remaining nodes called: " + remainder.map((x) => x.id))
                    finalCallback(shortlist)
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
    
    // Aggregate k closest results (sort results by distance and take the first k)
    // Perform async FIND_NODE on alpha closest of the k
    // Continue until nothing new is established
}

/**
 * I actually hate this implementation, but I'm tired, and I found a bug
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
    let top = bucketNumber - 1
    let bot = bucketNumber + 1
    while(closest.length < n && (bot >= 0 || top < B)) {
        if(buckets[bot] instanceof Bucket && bot >= 0)
        closest = closest.concat(buckets[bot].triples)
        if(buckets[top] instanceof Bucket && top < B)
        closest = closest.concat(buckets[top].triples)
        bot--
        top++
    }
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