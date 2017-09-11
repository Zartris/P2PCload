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
        winston.debug(this.triples.map(JSON.stringify) + "; " + JSON.stringify(triple));
        winston.debug(this.triples.map(JSON.stringify).includes(JSON.stringify(triple)));
        return this.triples.map(JSON.stringify).includes(JSON.stringify(triple))
    }

    put(triple) {
        if(!this.contains(triple) && this.triples.length < k) {
            this.triples.push(triple);
        }
        else if(!this.contains(triple)) {
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
        else {
            let index = this.triples.map(JSON.stringify).indexOf(JSON.stringify(triple));
            this.triples.splice(index);
            this.triples.push(triple);
        }
    }

}

app.set("view engine", "pug");
app.use(bodyParser.urlencoded({extended: true}));
app.use("/static", express.static("/public"));
const port = process.argv[2] ? parseInt(process.argv[2]) : 3000;
const alpha = process.argv[3] ? parseInt(process.argv[3]) : 3;
const B = process.argv[4] ? parseInt(process.argv[4]) : 8;
const k = process.argv[5] ? parseInt(process.argv[5]) : 10;
var id = undefined;
generateId();
var buckets = [];

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
    }
    else {
    joinTriple 
        = new Triple(req.body.node_address, 
                    req.body.node_port, 
                    req.body.node_id);
    }
    putTripleInBucket(joinTriple);
    winston.info("Join " + joinTriple.toString());
    // iterateFindNode on this
    nodeLookup(id);
    res.statusCode = 200;
    res.render("joined", {
        nodeid: id, 
        bucketlist: buckets, 
        nodeaddress: ip.address(), 
        nodeport: port});
    res.send();
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
 * FIND_NODE
 */
app.get('/api/kademlia/nodes/:id', (req, res) => {
    var reqID = parseInt(req.params["id"]);
    winston.debug("Requested ID: " + reqID);
    var closest = getNClosest(reqID, k);
    
    const randID = req.get("id");
    let triple = new Triple(req.header("node_address"),req.header("node_port"),req.header("node_id"));
    putTripleInBucket(triple);

    res.contentType("application/json");
    res.setHeader("id", randID);
    res.statusCode = 200;
    res.send(JSON.stringify(closest));
    winston.info("FIND_NODE(" + reqID + ") from " + triple + " returned " + (closest ? "Nothing!" : closest))
})

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
 * Technically iterativeNodeLookup
 * @param {*} id 
 */

function nodeLookup(reqID) {
    let closestNode = undefined;
    let closest = getNClosest(reqID, alpha);
    // Perform alpha async FIND_NODE calls
    let allResults = []; //Put actual results here (remember to exclude duplicates)
    async.map(closest, (triple, callback) => {
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
                callback(err, results);
            }
            else callback(err, []);
        })
    },
    (err, results) => {
        // When all calls are finished (basically, this version waits)
        allResults.concat.apply([],results); //Flatten the array of arrays
        winston.debug("Node lookup results: <" + allResults + ">");
        let kBestResults = allResults.sort((x, y) => (distance(reqID, x.id) - distance(reqID, id.y))).splice(0,k);
    })
    // Aggregate k closest results (sort results by distance and take the first k)
    // Perform async FIND_NODE on alpha closest of the k
    // Continue until nothing new is established
    return closestNode;
}

function getNClosest(reqID, n) {
    let dist = distance(id, reqID);
    let bucketNumber = dist === 0 ? 0 : Math.floor(Math.log2(dist));
    let closest = [];
    for(let i = bucketNumber; i <= B; i++) {
        if(closest.length < n) {
            if(buckets[i] instanceof Bucket) buckets[i].triples.forEach(triple => {
                if(closest.length < n) {
                    closest.push(triple);
                }
            })
        }
        else break;
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
    winston.debug("Adding " + triple + " to buckets")
    const dist = distance(id, triple.id);
    const i = dist === 0 ? 0 : Math.floor(Math.log2(dist));

    if (buckets[i] instanceof Bucket) {
        buckets[i].put(triple);
    } else {
        buckets[i] = new Bucket(triple, k);
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