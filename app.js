const express = require('express');
const ip = require('ip');
const crypto = require('crypto');

const app = express();

const port = 3000;
const alpha = 3;
const B = 8;
const k = 10;
var id = 0;

var buckets = [];

/**
 * Joins the kademlia network.
 */
app.post('/api/kademlia/join', function (req, res) {

    // Generate ID
    generateId();

    // Put known in bucket
    

    // iterateFindNode on  this  })
    res.send("ok");
})

app.get('/api/kademlia/nodes/:id', function (req, res) {
    var id = req.params["id"];

    
    
    res.send(id);
})

app.listen(port, function () {
    console.log('Example app listening on port 3000!')
})  


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


function generateId() {
    var address = ip.address();
    const hash = crypto.createHash("sha256", address + port).digest("hex");
    const bin = hex2bin(hash);
    const sub = bin.substring(0, B-1);
    const binId = parseInt(sub);
    id = bin2Dec(binId);
}

function putTripleInBucket(triple) {
    const distance = distance(id, triple.id);
    const i = Math.floor(getBaseLog(2, distance));

    if (buckets[i]) {
        buckets[i].put(triple);
    } else {
        buckets[i] = new Bucket(triple);
    }
}

function distance(a, b) {
    return a ^ b;
}

/**
 * The following function returns the logarithm of y with base x (ie. logxy).
 * @param {*} x 
 * @param {*} y 
 */
function getBaseLog(x, y) {
    return Math.log(y) / Math.log(x);
}