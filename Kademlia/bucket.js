module.exports = class Bucket {
    constructor(triple, k) {
        this.triples = [triple];
        this.k = k;
    }

    toString() {
        return this.triples.join();
    }

    contains(triple) {
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