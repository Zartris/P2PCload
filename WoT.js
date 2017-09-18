const express = require('express');
const winston = require("winston");
const request = require("request");
const bodyParser = require("body-parser");
const onoff = require("onoff")
const apidoc = require("apidoc")
const fs = require("fs")

class Sensor {
    constructor(pin, desc) {
        this.sensor = Gpio(pin, "in")
        this.pin = pin
        this.description = desc;
        this.latestValue = 0;
        sensor.watch((err, value) => {
            if(err){
                winston.error("Sensor error " + err)
            }
            else this.latestValue = value
        })
    }

    deregister() {
        this.sensor.deregister()
    }

    toString() {
            return actuator.toString()
    }
}

class Actuator {
    constructor(pin, desc) {
        this.actuator = new Gpio(pin, "out")
        this.pin = pin
        this.description = desc;
    }

    deregister() {
        this.actuator.deregister()
    }

    writeTo(value, callback) {
        actuator.write(value, callback)
    }

    toString() {
        return actuator.toString()
    }
}

const app = express();

var Gpio = onoff.Gpio
const port = process.argv[2] ? parseInt(process.argv[2]) : 3003;
var actuators = []
var sensors = []

winston.level = "debug";
winston.debug("Logging in debug mode");

//TODO: Do something clever to recognize devices
// One way to do this: A config file!
const config = require("./WoTConfig.json")
config.actuators.forEach((x) => actuators.push(new Actuator(x.pin, x.description)))
config.sensors.forEach((x) => sensors.push(new Sensor(x.pin, x.description)))

app.set("view engine", "pug");
app.use(bodyParser.urlencoded({extended: true}));
app.use("/static", express.static("/public"));


app.listen(port, () => {
    console.log('WoT node listening on port ' + port + "!")
})

app.get("/WoT/sensors/:id", (req, res) => {
    let reqID = (req.params["id"])
    let reqSensor = sensors[reqID]
    if(req.header("Accept") === "application/json") {
        res.send(JSON.stringify(reqSensor))
    }
    else {
        res.render("sensor", {
            rSensor: reqSensor
        });
    }
})

app.get("/WoT/actuators/:id", (req, res) => {
    let reqID = (req.params["id"])
    let reqActuator = actuators[reqID]
    if(req.header("Accept") === "application/json") {
        res.send(JSON.stringify(reqActuator))
    }
    else {
        res.render("actuator", {
            rActuator: reqActuator,
            id: reqID
        });
    }
})

app.post("/WoT/actuators/:id/write", (req, res) => {
    let reqID = (req.params["id"])
    let reqActuator = actuators[reqID]
    let data = undefined
    if(req.body.data === undefined) data = req.header("writeData")
    else data = req.body.data
    reqActuator.writeTo(data, () => {
        winston.info("Data written to actuator number " + reqID + ": " + data)
    })
    res.sendStatus(200)
})

app.get("/WoT", (req, res) => {
    if(req.header("Accept") === "application/json") {
        res.send(JSON.stringify(sensors))
    }
    else {
        res.render("WoT-devices", {
            rSensors: sensors,
            rActuators: actuators
        });
    }
})

process.on('SIGINT', () => {
    winston.info("Sensors properly disabled")
    actuators.forEach((x) => x.deregister())
    sensors.forEach((x) => x.deregister())   
    process.exit();
  });