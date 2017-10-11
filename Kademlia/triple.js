module.exports = class Triple {
    constructor(ip, port, id) {
        this.ip = ip;
        this.port = port;
        this.id = id;
    }

    toString() {
        return "<" + this.ip + "," + this.port + "," + this.id + ">"
    }
}