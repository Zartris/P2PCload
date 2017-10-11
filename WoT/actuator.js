module.exports = class Actuator {
    constructor(pin, desc) {
        this.actuator = new Gpio(pin, "out")
        this.pin = pin
        this.description = desc;
    }

    deregister() {
        this.actuator.unexport()
    }

    writeTo(value, callback) {
        this.actuator.write(value, callback)
    }

    toString() {
        return this.actuator.toString()
    }
}